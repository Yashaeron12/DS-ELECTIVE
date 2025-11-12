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

// GET /api/files/simple - Simple file listing without complex queries
router.get('/simple', verifyToken, async (req, res) => {
  console.log('📋 Simple file listing for user:', req.user.uid);
  try {
    // Get all files and filter in JavaScript to avoid index issues
    const allFiles = await db.collection('files').get();
    console.log('📊 Total files in database:', allFiles.size);
    
    const userFiles = [];
    
    allFiles.forEach(doc => {
      const data = doc.data();
      // Filter for current user
      if (data.uploadedBy === req.user.uid) {
        userFiles.push({
          id: doc.id,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          downloadUrl: data.downloadUrl,
          uploadedBy: data.uploadedBy,
          workspaceId: data.workspaceId || null,
          description: data.description || '',
          isPublic: data.isPublic || false,
          downloadCount: data.downloadCount || 0,
          storagePath: data.storagePath, // Include storage path for debugging
          uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      }
    });
    
    // Sort by upload date
    userFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    console.log('✅ Found', userFiles.length, 'files for user');
    console.log('📋 Files:', userFiles.map(f => f.fileName));
    
    res.json({ files: userFiles });
  } catch (error) {
    console.error('💥 Error in simple file listing:', error);
    res.status(500).json({ error: 'Failed to fetch files', details: error.message });
  }
});

// GET /api/files - List files for user (requires VIEW_FILES permission)
router.get('/', verifyToken, requirePermission(PERMISSIONS.VIEW_FILES), async (req, res) => {
  console.log('📋 Fetching files for user:', req.user.uid);
  try {
    const { workspaceId, isPublic } = req.query;
    
    console.log('🔍 Starting simple Firestore query...');
    
    // Use the simplest possible query to avoid index issues
    let filesRef;
    if (workspaceId) {
      console.log('🏢 Filtering by workspace:', workspaceId);
      filesRef = db.collection('files').where('workspaceId', '==', workspaceId);
    } else if (isPublic === 'true') {
      console.log('🌐 Fetching public files');
      filesRef = db.collection('files').where('isPublic', '==', true);
    } else {
      console.log('👤 Fetching user files for:', req.user.uid);
      // Try the simplest possible query first
      filesRef = db.collection('files').where('uploadedBy', '==', req.user.uid);
    }
    
    console.log('� Executing query...');
    const snapshot = await filesRef.get();
    console.log('📊 Query completed. Documents found:', snapshot.size);
    
    const files = [];
    
    snapshot.forEach(doc => {
      try {
        const data = doc.data();
        console.log('📄 Processing file:', { id: doc.id, name: data.fileName, size: data.fileSize });
        
        files.push({
          id: doc.id,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          downloadUrl: data.downloadUrl,
          uploadedBy: data.uploadedBy,
          workspaceId: data.workspaceId || null,
          description: data.description || '',
          isPublic: data.isPublic || false,
          downloadCount: data.downloadCount || 0,
          storagePath: data.storagePath, // Include storage path for debugging
          uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        });
      } catch (docError) {
        console.error('Error processing document:', doc.id, docError);
      }
    });
    
    // Sort files by uploadedAt in JavaScript
    files.sort((a, b) => {
      const aDate = new Date(a.uploadedAt || 0);
      const bDate = new Date(b.uploadedAt || 0);
      return bDate - aDate;
    });
    
    console.log('✅ Successfully processed', files.length, 'files');
    console.log('📋 File names:', files.map(f => f.fileName));
    
    res.json({ files });
  } catch (error) {
    console.error('💥 Error fetching files:', error);
    console.error('💥 Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch files', 
      details: error.message,
      code: error.code 
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

    const { workspaceId, description, isPublic = false, taskId } = req.body;
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
      fileName: file.originalname, // Keep for backend compatibility
      originalName: file.originalname, // Add for frontend compatibility
      storagePath: file.path, // Local file path
      fileSize: file.size,
      size: file.size, // Add alias for frontend
      mimeType: file.mimetype,
      downloadUrl: downloadUrl,
      uploadedBy: req.user.uid,
      workspaceId: workspaceId || null,
      description: description || '',
      isPublic: Boolean(isPublic),
      // Task-File Integration Fields
      taskId: taskId || null, // Direct task reference for easy querying
      linkedTasks: taskId ? [taskId] : [], // Array of task IDs this file is linked to
      taskCount: taskId ? 1 : 0, // Quick count of linked tasks
      downloadCount: 0,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('💾 Saving file metadata to Firestore...');
    const docRef = await db.collection('files').add(fileData);
    console.log('✅ File metadata saved with ID:', docRef.id);

    // Handle automatic task attachment if taskId is provided
    if (taskId) {
      try {
        console.log('🔗 Linking file to task:', taskId);
        
        // Get task document
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (taskDoc.exists) {
          const taskData = taskDoc.data();
          
          // Check if user has permission to attach to this task
          if (taskData.userId === req.user.uid || taskData.assignedTo === req.user.uid) {
            // Update file with task reference (taskId and linkedTasks already set above)
            await docRef.update({
              description: `${description || ''} (Attached to task: ${taskData.title})`.trim()
            });
            
            // Update task with file reference
            await taskDoc.ref.update({
              attachedFiles: admin.firestore.FieldValue.arrayUnion(docRef.id),
              attachmentCount: admin.firestore.FieldValue.increment(1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ File automatically linked to task:', taskId);
            
            // Send task update notification if assigned to someone else
            if (taskData.assignedTo && taskData.assignedTo !== req.user.uid) {
              try {
                await notificationHelpers.fileAttachedToTask({
                  taskId: taskId,
                  taskTitle: taskData.title,
                  fileName: file.originalname,
                  attachedBy: req.user.uid
                }, taskData.assignedTo);
              } catch (notificationError) {
                console.error('Error sending task file notification:', notificationError);
              }
            }
            
            // Send real-time update
            if (taskData.workspaceId) {
              socketService.sendTaskUpdate({
                id: taskId,
                title: taskData.title,
                attachmentCount: (taskData.attachmentCount || 0) + 1
              }, 'file-uploaded-to-task', req.user.uid);
            }
          } else {
            console.warn('❌ User lacks permission to attach file to task:', taskId);
          }
        } else {
          console.warn('❌ Task not found for attachment:', taskId);
        }
      } catch (taskError) {
        console.error('Error linking file to task:', taskError);
        // Don't fail file upload if task linking fails
      }
    }

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
    
    console.log('🔽 Download request for fileId:', fileId);
    
    // Try to find file by ID first, then by storage path
    let fileDoc = await db.collection('files').doc(fileId).get();
    let fileData = null;
    
    if (fileDoc.exists) {
      console.log('✅ Found file by ID:', fileId);
      fileData = fileDoc.data();
    } else {
      console.log('🔍 File ID not found, searching by storage path...');
      
      // Search by storage path matching
      const allFiles = await db.collection('files').get();
      let foundFile = false;
      
      allFiles.forEach(doc => {
        if (!foundFile) {  // Only search if we haven't found one yet
          const data = doc.data();
          if (data.storagePath) {
            // Extract filename without extension from storage path
            const fileName = path.basename(data.storagePath, path.extname(data.storagePath));
            console.log('🔍 Checking file:', fileName, 'against', fileId);
            
            // Try multiple matching strategies
            if (fileName === fileId || 
                data.storagePath.includes(fileId) || 
                doc.id === fileId ||
                data.storagePath.endsWith(`/${fileId}.docx`) ||
                data.storagePath.endsWith(`/${fileId}.txt`) ||
                data.storagePath.endsWith(`/${fileId}.pdf`)) {
              console.log('✅ Found matching file:', data.fileName);
              fileDoc = doc;
              fileData = data;
              foundFile = true;
            }
          }
        }
      });
    }
    
    if (!fileData) {
      console.log('❌ File not found in database for fileId:', fileId);
      return res.status(404).json({ error: 'File not found in database' });
    }
    
    console.log('📁 File storage path:', fileData.storagePath);
    
    // Resolve the full file path
    let fullFilePath = fileData.storagePath;
    if (!path.isAbsolute(fullFilePath)) {
      fullFilePath = path.join(__dirname, '..', fullFilePath);
    }
    
    console.log('📁 Resolved full path:', fullFilePath);
    
    // Check if file exists on disk
    if (!fs.existsSync(fullFilePath)) {
      console.log('❌ File not found on disk:', fullFilePath);
      
      // Try alternative path in uploads directory
      const alternativePath = path.join(__dirname, '..', 'uploads', fileData.uploadedBy, path.basename(fullFilePath));
      console.log('🔍 Trying alternative path:', alternativePath);
      
      if (fs.existsSync(alternativePath)) {
        fullFilePath = alternativePath;
        console.log('✅ Found file at alternative path');
      } else {
        return res.status(404).json({ error: 'File not found on disk' });
      }
    }
    
    console.log('✅ File exists, serving download');
    
    // Update download count
    await fileDoc.ref.update({
      downloadCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.setHeader('Content-Type', fileData.mimeType);
    
    // Stream the file using the resolved path
    const fileStream = fs.createReadStream(fullFilePath);
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

// GET /api/files/debug - Debug endpoint to check Firestore files collection
router.get('/debug', verifyToken, async (req, res) => {
  try {
    console.log('🔧 Debug: Checking files collection...');
    
    // Get all files without any filtering
    const allFiles = await db.collection('files').get();
    console.log('🔧 Debug: Total files in database:', allFiles.size);
    
    const files = [];
    allFiles.forEach(doc => {
      const data = doc.data();
      files.push({
        id: doc.id,
        fileName: data.fileName,
        uploadedBy: data.uploadedBy,
        createdAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt
      });
    });
    
    console.log('🔧 Debug: Files found:', files);
    
    res.json({ 
      totalFiles: allFiles.size,
      files: files,
      userUid: req.user.uid
    });
  } catch (error) {
    console.error('🔧 Debug error:', error);
    res.status(500).json({ 
      error: 'Debug failed',
      details: error.message 
    });
  }
});

// ========================= TASK-FILE INTEGRATION ENDPOINTS =========================

// GET /api/files/by-task/:taskId - Get all files linked to a specific task
router.get('/by-task/:taskId', verifyToken, requirePermission(PERMISSIONS.VIEW_FILES), async (req, res) => {
  try {
    const { taskId } = req.params;
    
    // Verify task exists and user has access
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    if (taskData.userId !== req.user.uid && taskData.assignedTo !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get files linked to this task
    const filesSnapshot = await db.collection('files')
      .where('linkedTasks', 'array-contains', taskId)
      .get();
    
    const files = [];
    filesSnapshot.forEach(doc => {
      const data = doc.data();
      files.push({
        id: doc.id,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        downloadUrl: data.downloadUrl,
        uploadedBy: data.uploadedBy,
        description: data.description || '',
        uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
        taskCount: data.taskCount || 0,
        linkedTasks: data.linkedTasks || []
      });
    });
    
    // Sort by upload date
    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    res.json({
      files: files,
      taskId: taskId,
      taskTitle: taskData.title,
      totalFiles: files.length
    });
    
  } catch (error) {
    console.error('Error fetching files by task:', error);
    res.status(500).json({ error: 'Failed to fetch files for task' });
  }
});

// GET /api/files/:fileId/tasks - Get all tasks linked to a specific file
router.get('/:fileId/tasks', verifyToken, requirePermission(PERMISSIONS.VIEW_TASKS), async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Get file document
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = fileDoc.data();
    
    // Check file access permissions
    if (fileData.uploadedBy !== req.user.uid && !fileData.isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const linkedTaskIds = fileData.linkedTasks || [];
    
    if (linkedTaskIds.length === 0) {
      return res.json({
        tasks: [],
        fileId: fileId,
        fileName: fileData.fileName,
        totalTasks: 0
      });
    }
    
    // Get all linked tasks
    const taskPromises = linkedTaskIds.map(taskId => 
      db.collection('tasks').doc(taskId).get()
    );
    
    const taskDocs = await Promise.all(taskPromises);
    
    const tasks = [];
    taskDocs.forEach((doc, index) => {
      if (doc.exists) {
        const data = doc.data();
        // Only include tasks user has access to
        if (data.userId === req.user.uid || data.assignedTo === req.user.uid) {
          tasks.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            priority: data.priority,
            completed: data.completed,
            dueDate: data.dueDate,
            assignedTo: data.assignedTo,
            workspaceId: data.workspaceId,
            attachmentCount: data.attachmentCount || 0,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          });
        }
      }
    });
    
    res.json({
      tasks: tasks,
      fileId: fileId,
      fileName: fileData.fileName,
      totalTasks: tasks.length
    });
    
  } catch (error) {
    console.error('Error fetching tasks for file:', error);
    res.status(500).json({ error: 'Failed to fetch tasks for file' });
  }
});

// GET /api/files/with-tasks - Get all files that have task attachments
router.get('/with-tasks', verifyToken, requirePermission(PERMISSIONS.VIEW_FILES), async (req, res) => {
  try {
    // Get files that have linkedTasks array with at least one item
    const filesSnapshot = await db.collection('files')
      .where('uploadedBy', '==', req.user.uid)
      .get();
    
    const filesWithTasks = [];
    
    filesSnapshot.forEach(doc => {
      const data = doc.data();
      const linkedTasks = data.linkedTasks || [];
      
      if (linkedTasks.length > 0) {
        filesWithTasks.push({
          id: doc.id,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
          taskCount: data.taskCount || 0,
          linkedTasks: linkedTasks,
          description: data.description || ''
        });
      }
    });
    
    // Sort by task count (most linked first)
    filesWithTasks.sort((a, b) => (b.taskCount || 0) - (a.taskCount || 0));
    
    res.json({
      files: filesWithTasks,
      totalFiles: filesWithTasks.length
    });
    
  } catch (error) {
    console.error('Error fetching files with tasks:', error);
    res.status(500).json({ error: 'Failed to fetch files with task links' });
  }
});

module.exports = router;