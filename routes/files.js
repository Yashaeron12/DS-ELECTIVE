// routes/files.js - File upload, storage and sharing
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
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

// GET /api/files - Get all files for authenticated user
router.get('/', verifyToken, async (req, res) => {
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

// POST /api/files/upload - Upload a new file
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { workspaceId, description, isPublic = false } = req.body;
    const file = req.file;
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.originalname}`;
    const filePath = `files/${req.user.uid}/${fileName}`;
    
    // Upload to Firebase Storage
    const fileRef = bucket.file(filePath);
    const stream = fileRef.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: req.user.uid,
          originalName: file.originalname
        }
      }
    });

    stream.on('error', (error) => {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    });

    stream.on('finish', async () => {
      try {
        // Make file publicly readable if needed
        if (isPublic) {
          await fileRef.makePublic();
        }
        
        // Get download URL
        const [url] = await fileRef.getSignedUrl({
          action: 'read',
          expires: '03-09-2491' // Far future date
        });

        // Save file metadata to Firestore
        const fileData = {
          fileName: file.originalname,
          storagePath: filePath,
          fileSize: file.size,
          mimeType: file.mimetype,
          downloadUrl: url,
          uploadedBy: req.user.uid,
          workspaceId: workspaceId || null,
          description: description || '',
          isPublic: Boolean(isPublic),
          downloadCount: 0,
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('files').add(fileData);

        res.status(201).json({
          id: docRef.id,
          message: 'File uploaded successfully',
          ...fileData,
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error saving file metadata:', error);
        res.status(500).json({ error: 'Failed to save file metadata' });
      }
    });

    stream.end(file.buffer);

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/files/:id/download - Download a file
router.get('/:id/download', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get file metadata
    const fileDoc = await db.collection('files').doc(id).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    // Check permissions (owner or public file)
    if (fileData.uploadedBy !== req.user.uid && !fileData.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Increment download count
    await db.collection('files').doc(id).update({
      downloadCount: admin.firestore.FieldValue.increment(1),
      lastDownloaded: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Redirect to download URL
    res.redirect(fileData.downloadUrl);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// PUT /api/files/:id - Update file metadata
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, isPublic } = req.body;
    
    // Verify file ownership
    const fileRef = db.collection('files').doc(id);
    const fileDoc = await fileRef.get();
    
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    if (fileData.uploadedBy !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your file' });
    }
    
    // Update metadata
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

// DELETE /api/files/:id - Delete a file
router.delete('/:id', verifyToken, async (req, res) => {
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

// POST /api/files/:id/share - Share a file with another user
router.post('/:id/share', verifyToken, async (req, res) => {
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

// GET /api/files/shared - Get files shared with current user
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

module.exports = router;
