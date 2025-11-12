// routes/files.js - File upload, storage and sharing with RBAC (Local Storage Version)
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const { requirePermission, requireOwnershipOrRole, PERMISSIONS, ROLES } = require('../middleware/rbac');
const { notificationHelpers } = require('../services/notificationService');
const socketService = require('../services/socketService');

const db = admin.firestore();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

// Configure multer for local file storage
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Create user-specific folder
      const userDir = path.join(uploadsDir, req.user?.uid || 'anonymous');
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.originalname}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-rar-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// GET /api/files - List files for user (requires VIEW_FILES permission)
router.get('/', verifyToken, requirePermission(PERMISSIONS.VIEW_FILES), async (req, res) => {
  try {
    const { workspaceId, isPublic } = req.query;
    
    let query = db.collection('files');
    
    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    } else if (isPublic === 'true') {
      query = query.where('isPublic', '==', true);
    } else {
      // Show user's own files
      query = query.where('uploadedBy', '==', req.user.uid);
    }
    
    const snapshot = await query.orderBy('uploadedAt', 'desc').get();
    const files = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      files.push({
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      });
    });
    
    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// POST /api/files/upload - Upload file (requires UPLOAD_FILES permission)
router.post('/upload', verifyToken, requirePermission(PERMISSIONS.UPLOAD_FILES), upload.single('file'), async (req, res) => {
  console.log('📤 Upload request received');
  console.log('User:', req.user?.uid);
  console.log('File:', req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype, path: req.file.path } : 'No file');
  
  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { workspaceId, description, isPublic = false } = req.body;
    const file = req.file;
    
    console.log('📁 File details:', {
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      localPath: file.path,
      description,
      workspaceId,
      isPublic
    });

    console.log('✅ File saved locally successfully at:', file.path);

    // Generate download URL for local file
    const fileId = path.basename(file.path, path.extname(file.path));
    const downloadUrl = `http://localhost:5000/api/files/download/${fileId}`;

    // Save file metadata to Firestore
    const fileData = {
      fileName: file.originalname,
      storagePath: file.path, // Local file path
      fileSize: file.size,
      mimeType: file.mimetype,
      downloadUrl: downloadUrl,
      uploadedBy: req.user.uid,
      workspaceId: workspaceId || null,
      description: description || '',
      isPublic: Boolean(isPublic),
      downloadCount: 0,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('💾 Saving file metadata to Firestore...');
    const docRef = await db.collection('files').add(fileData);
    console.log('✅ File metadata saved with ID:', docRef.id);

    // Send notifications if file is uploaded to a workspace
    if (workspaceId) {
      try {
        console.log('📨 Sending workspace notifications...');
        // Get workspace details and members
        const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
        const membersSnapshot = await db.collection('workspaceMembers')
          .where('workspaceId', '==', workspaceId)
          .get();

        if (workspaceDoc.exists) {
          const workspaceData = workspaceDoc.data();
          const members = [];
          
          // Add workspace owner
          members.push({ userId: workspaceData.ownerId });
          
          // Add workspace members
          membersSnapshot.forEach(doc => {
            const memberData = doc.data();
            if (memberData.userId !== workspaceData.ownerId) {
              members.push({ userId: memberData.userId });
            }
          });

          // Get uploader details
          const uploaderData = await admin.auth().getUser(req.user.uid);

          // Send notifications to workspace members
          await notificationHelpers.fileUploaded({
            id: docRef.id,
            fileName: file.originalname,
            uploaderName: uploaderData.displayName || uploaderData.email,
            workspaceName: workspaceData.name,
            workspaceId: workspaceId
          }, req.user.uid, members);

          // Send real-time activity update to workspace
          socketService.sendFileUpdate(workspaceId, {
            id: docRef.id,
            name: file.originalname,
            size: file.size,
            uploadedBy: uploaderData.displayName || uploaderData.email
          }, 'uploaded', req.user.uid);
        }
      } catch (notificationError) {
        console.error('Error sending file upload notifications:', notificationError);
        // Don't fail the upload if notifications fail
      }
    }

    console.log('✅ File upload process completed successfully!');
    
    res.status(201).json({
      id: docRef.id,
      message: 'File uploaded successfully',
      ...fileData,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

// GET /api/files/download/:fileId - Download file
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Find the file in the database
    const filesSnapshot = await db.collection('files')
      .where('storagePath', '>=', `uploads`)
      .get();
    
    let fileDoc = null;
    let fileData = null;
    
    filesSnapshot.forEach(doc => {
      const data = doc.data();
      const fileName = path.basename(data.storagePath, path.extname(data.storagePath));
      if (fileName === fileId) {
        fileDoc = doc;
        fileData = data;
      }
    });
    
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(fileData.storagePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Update download count
    await fileDoc.ref.update({
      downloadCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.setHeader('Content-Type', fileData.mimeType);
    
    // Stream the file
    const fileStream = fs.createReadStream(fileData.storagePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// DELETE /api/files/:id - Delete file
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const fileDoc = await db.collection('files').doc(id).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    // Check if user owns the file or has appropriate permissions
    if (fileData.uploadedBy !== req.user.uid) {
      // Check if user has DELETE_FILES permission for workspace
      if (fileData.workspaceId) {
        const hasPermission = await requireOwnershipOrRole(ROLES.MANAGER)(req, res, () => {});
        if (!hasPermission) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    // Delete file from disk
    if (fs.existsSync(fileData.storagePath)) {
      fs.unlinkSync(fileData.storagePath);
      console.log('🗑️ File deleted from disk:', fileData.storagePath);
    }
    
    // Delete from database
    await fileDoc.ref.delete();
    
    res.json({ message: 'File deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Test storage connection
router.get('/test-storage', verifyToken, async (req, res) => {
  try {
    console.log('🧪 Testing local storage...');
    console.log('📁 Uploads directory:', uploadsDir);
    console.log('📊 Directory exists:', fs.existsSync(uploadsDir));
    
    res.json({ 
      success: true, 
      storageType: 'local',
      uploadsDir: uploadsDir,
      exists: fs.existsSync(uploadsDir),
      message: 'Local storage connection working'
    });
  } catch (error) {
    console.error('Local storage test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Local storage connection failed',
      details: error.message 
    });
  }
});

module.exports = router;