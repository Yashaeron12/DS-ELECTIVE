// routes/files.js - File upload, storage and sharing with RBAC
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
    fileSize: 10 * 1024 * 1024, 
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
      cb(new Error('File type not allowed'), false);
    }
  }
});


// GET /api/files - Get all files for user (requires VIEW_FILES permission)
router.get('/', verifyToken, requirePermission(PERMISSIONS.VIEW_FILES), async (req, res) => {
  try {
    const { workspaceId } = req.query;
    
    let query = db.collection('files')
      .where('uploadedBy', '==', req.user.uid);
    
    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }
    
    const filesSnapshot = await query
      .orderBy('uploadedAt', 'desc')
      .get();
    
    const files = [];
    filesSnapshot.forEach(doc => {
      const data = doc.data();
      files.push({
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null
      });
    });
    
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Test endpoint for Firebase Storage
router.get('/test-storage', verifyToken, async (req, res) => {
  try {
    console.log('Testing Firebase Storage connection...');
    const testBucket = admin.storage().bucket();
    console.log('Storage bucket name:', testBucket.name);
    
    // Try to list files to test connection
    const [files] = await testBucket.getFiles({ maxResults: 1 });
    console.log('Storage connection successful, found', files.length, 'files');
    
    res.json({ 
      success: true, 
      bucketName: testBucket.name,
      message: 'Firebase Storage connection working'
    });
  } catch (error) {
    console.error('Firebase Storage test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Firebase Storage connection failed',
      details: error.message 
    });
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
    const downloadUrl = `http://localhost:5000/api/files/download/${path.basename(file.path)}`;

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
        console.error('💥 Error in upload process:', error);
        res.status(500).json({ error: 'Failed to process upload', details: error.message });
      }
    });

    console.log('📤 Starting file upload to Firebase Storage...');
    stream.end(file.buffer);
          responseAlreadySent = true;
          res.status(500).json({ error: 'Failed to save file metadata', details: error.message });
        }
      }
    });

    console.log('📤 Starting file upload to Firebase Storage...');
    stream.end(file.buffer);

  } catch (error) {
    console.error('💥 Upload error (outer catch):', error);
    if (!responseAlreadySent) {
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  }
});


router.get('/:id/download', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    

    const fileDoc = await db.collection('files').doc(id).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    

    if (fileData.uploadedBy !== req.user.uid && !fileData.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    

    await db.collection('files').doc(id).update({
      downloadCount: admin.firestore.FieldValue.increment(1),
      lastDownloaded: admin.firestore.FieldValue.serverTimestamp()
    });
    

    res.redirect(fileData.downloadUrl);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});


router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, isPublic } = req.body;
    

    const fileRef = db.collection('files').doc(id);
    const fileDoc = await fileRef.get();
    
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    if (fileData.uploadedBy !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your file' });
    }
    

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);
    
    await fileRef.update(updateData);
    
    res.json({
      message: 'File updated successfully',
      id: id
    });
    
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

//Delete a file
// DELETE /api/files/:id - Delete file (requires file ownership or DELETE_FILES permission)
// DELETE /api/files/:id - Delete file (requires UPLOAD_FILES permission and ownership OR MANAGER+ role)
router.delete('/:id', verifyToken, requireOwnershipOrRole(ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get file data
    const fileDoc = await db.collection('files').doc(id).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    // Verify ownership
    if (fileData.uploadedBy !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your file' });
    }
    
    // Delete from Storage
    try {
      await bucket.file(fileData.storagePath).delete();
    } catch (storageError) {
      console.warn('File not found in storage (may have been deleted):', storageError.message);
    }
    
    // Delete from Firestore
    await db.collection('files').doc(id).delete();
    
    res.json({
      message: 'File deleted successfully',
      deletedFile: {
        id: id,
        fileName: fileData.fileName
      }
    });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

//Share a file with another user
// POST /api/files/:id/share - Share file with user (requires SHARE_FILES permission)
router.post('/:id/share', verifyToken, requirePermission(PERMISSIONS.SHARE_FILES), async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, permission = 'read' } = req.body; // read or write
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    // Verify file ownership
    const fileDoc = await db.collection('files').doc(id).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    if (fileData.uploadedBy !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your file' });
    }
    
    // Find user by email
    let targetUser;
    try {
      targetUser = await admin.auth().getUserByEmail(userEmail);
    } catch (error) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create file share record
    const shareData = {
      fileId: id,
      fileName: fileData.fileName,
      sharedBy: req.user.uid,
      sharedWith: targetUser.uid,
      permission: permission,
      sharedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('fileShares').add(shareData);
    
    // Send file shared notification
    try {
      const sharerData = await admin.auth().getUser(req.user.uid);
      const { createNotification, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('../services/notificationService');
      
      const notificationId = await createNotification({
        userId: targetUser.uid,
        type: NOTIFICATION_TYPES.FILE_SHARED,
        title: 'File shared with you',
        message: `${sharerData.displayName || sharerData.email} shared "${fileData.fileName}" with you`,
        priority: PRIORITY_LEVELS.MEDIUM,
        metadata: {
          fileId: id,
          fileName: fileData.fileName,
          sharedBy: req.user.uid,
          sharerName: sharerData.displayName || sharerData.email,
          permission: permission
        },
        triggeredBy: req.user.uid
      });

      // Send real-time notification
      if (notificationId) {
        socketService.sendNotificationToUser(targetUser.uid, {
          id: notificationId,
          type: NOTIFICATION_TYPES.FILE_SHARED,
          title: 'File shared with you',
          message: `${sharerData.displayName || sharerData.email} shared "${fileData.fileName}" with you`,
          priority: PRIORITY_LEVELS.MEDIUM,
          metadata: {
            fileId: id,
            fileName: fileData.fileName,
            permission: permission
          },
          createdAt: new Date().toISOString(),
          isRead: false
        });
      }
    } catch (notificationError) {
      console.error('Error sending file share notification:', notificationError);
      // Don't fail the sharing if notifications fail
    }
    
    res.json({
      message: 'File shared successfully',
      sharedWith: userEmail,
      permission: permission
    });
    
  } catch (error) {
    console.error('Error sharing file:', error);
    res.status(500).json({ error: 'Failed to share file' });
  }
});

// Get files shared with current user
router.get('/shared', verifyToken, async (req, res) => {
  try {
    const sharesSnapshot = await db.collection('fileShares')
      .where('sharedWith', '==', req.user.uid)
      .orderBy('sharedAt', 'desc')
      .get();
    
    const sharedFiles = [];
    for (const doc of sharesSnapshot.docs) {
      const shareData = doc.data();
      
      // Get file details
      const fileDoc = await db.collection('files').doc(shareData.fileId).get();
      if (fileDoc.exists) {
        const fileData = fileDoc.data();
        sharedFiles.push({
          shareId: doc.id,
          fileId: shareData.fileId,
          ...fileData,
          sharedBy: shareData.sharedBy,
          permission: shareData.permission,
          sharedAt: shareData.sharedAt?.toDate?.() || null
        });
      }
    }
    
    res.json(sharedFiles);
    
  } catch (error) {
    console.error('Error fetching shared files:', error);
    res.status(500).json({ error: 'Failed to fetch shared files' });
  }
});

// Get user storage statistics (only user-uploaded files)
router.get('/storage-stats', verifyToken, async (req, res) => {
  try {
    // Get all user's files from Firestore
    const filesSnapshot = await db.collection('files')
      .where('uploadedBy', '==', req.user.uid)
      .get();
    
    let totalSize = 0;
    let fileCount = 0;
    
    // Calculate total size of user's actual files only
    filesSnapshot.forEach(doc => {
      const fileData = doc.data();
      if (fileData.fileSize) {
        totalSize += fileData.fileSize;
        fileCount++;
      }
    });
    
    // Convert to appropriate units
    const sizeInMB = totalSize / (1024 * 1024);
    const sizeInGB = totalSize / (1024 * 1024 * 1024);
    
    // Define storage limits (can be configured per user plan)
    const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB in bytes
    const storageLimitGB = 10; // 10GB
    
    // Calculate usage percentage (only user files, not system defaults)
    const usagePercentage = (totalSize / storageLimit) * 100;
    
    res.json({
      success: true,
      storage: {
        usedBytes: totalSize,
        usedMB: Math.round(sizeInMB * 100) / 100,
        usedGB: Math.round(sizeInGB * 100) / 100,
        limitGB: storageLimitGB,
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        fileCount: fileCount,
        availableGB: Math.round((storageLimitGB - sizeInGB) * 100) / 100
      }
    });
    
  } catch (error) {
    console.error('Error calculating storage stats:', error);
    res.status(500).json({ error: 'Failed to calculate storage usage' });
  }
});

module.exports = router;