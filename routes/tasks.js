const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { verifyToken } = require('../middleware/auth');
const { 
  ROLES, 
  PERMISSIONS, 
  requirePermission, 
  requireOwnershipOrRole 
} = require('../middleware/rbac');
const { notificationHelpers } = require('../services/notificationService');
const socketService = require('../services/socketService');

const db = admin.firestore();

router.get('/', verifyToken, requirePermission(PERMISSIONS.VIEW_TASKS), async (req, res) => {
  try {
    const tasksSnapshot = await db.collection('tasks')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    
    const tasks = [];
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      tasks.push({ 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null
      });
    });
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', verifyToken, requirePermission(PERMISSIONS.CREATE_TASKS), async (req, res) => {
  try {
    const { title, description, priority = 'medium', dueDate, category = 'general', assignedTo, workspaceId } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }
    
    const taskData = {
      title,
      description,
      priority,
      dueDate: dueDate || null,
      category,
      userId: req.user.uid,
      assignedTo: assignedTo || req.user.uid,
      workspaceId: workspaceId || null,
      completed: false,
      attachedFiles: [],
      attachmentCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('tasks').add(taskData);
    
    if (assignedTo && assignedTo !== req.user.uid) {
      try {
        await notificationHelpers.taskAssigned({
          id: docRef.id,
          title: title,
          workspaceId: workspaceId,
          dueDate: dueDate
        }, req.user.uid, assignedTo);

        // Send real-time task update
        socketService.sendTaskUpdate({
          id: docRef.id,
          title: title,
          assignedTo: assignedTo,
          workspaceId: workspaceId
        }, 'assigned', req.user.uid);
      } catch (notificationError) {
        console.error('Error sending task assignment notification:', notificationError);
        // Don't fail the task creation if notifications fail
      }
    }
    
    res.status(201).json({ 
      id: docRef.id, 
      ...taskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task (requires ownership OR MANAGER+ role)
router.put('/:id', verifyToken, requireOwnershipOrRole(ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Updating task:', id, 'for user:', req.user.uid);
    
    // First, verify the task exists and belongs to the user
    const taskRef = db.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    if (taskData.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your task' });
    }
    
    // Prepare update data
    const allowedFields = ['title', 'description', 'priority', 'dueDate', 'category', 'completed'];
    const updateData = {};
    
    // Only update provided fields
    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        updateData[field] = req.body[field];
      }
    }
    
    // Always update the timestamp
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    // Update the task
    await taskRef.update(updateData);
    
    // Get the updated task to return
    const updatedDoc = await taskRef.get();
    const updatedTask = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.() || null,
      updatedAt: updatedDoc.data().updatedAt?.toDate?.() || new Date()
    };
    
    console.log('Task updated successfully');
    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
    
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      error: 'Failed to update task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/tasks/:id - Delete task (requires ownership OR MANAGER+ role)
router.delete('/:id', verifyToken, requireOwnershipOrRole(ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting task:', id, 'for user:', req.user.uid);
    
    // First, verify the task exists and belongs to the user
    const taskRef = db.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    if (taskData.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your task' });
    }
    
    // Store task data before deletion for response
    const deletedTask = {
      id: taskDoc.id,
      ...taskData,
      createdAt: taskData.createdAt?.toDate?.() || null,
      updatedAt: taskData.updatedAt?.toDate?.() || null
    };
    
    // Delete the task
    await taskRef.delete();
    
    console.log('Task deleted successfully');
    res.json({
      message: 'Task deleted successfully',
      deletedTask: deletedTask
    });
    
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ 
      error: 'Failed to delete task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH /api/tasks/:id/complete - Toggle task completion (requires ownership OR MANAGER+ role)
router.patch('/:id/complete', verifyToken, requireOwnershipOrRole(ROLES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Toggling completion for task:', id);
    
    const taskRef = db.collection('tasks').doc(id);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    if (taskData.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not your task' });
    }
    
    // Toggle completion status
    const newCompletionStatus = !taskData.completed;
    
    await taskRef.update({
      completed: newCompletionStatus,
      completedAt: newCompletionStatus ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Send notification if task is completed and was assigned by someone else
    if (newCompletionStatus && taskData.userId !== req.user.uid) {
      try {
        const { createNotification, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('../services/notificationService');
        const completerData = await admin.auth().getUser(req.user.uid);
        
        await createNotification({
          userId: taskData.userId,
          type: NOTIFICATION_TYPES.TASK_COMPLETED,
          title: 'Task completed',
          message: `${completerData.displayName || completerData.email} completed task: "${taskData.title}"`,
          priority: PRIORITY_LEVELS.MEDIUM,
          metadata: {
            taskId: id,
            taskTitle: taskData.title,
            completedBy: req.user.uid,
            completerName: completerData.displayName || completerData.email
          },
          triggeredBy: req.user.uid
        });

        // Send real-time task update
        socketService.sendTaskUpdate({
          id: id,
          title: taskData.title,
          assignedTo: taskData.assignedTo,
          workspaceId: taskData.workspaceId
        }, newCompletionStatus ? 'completed' : 'reopened', req.user.uid);
      } catch (notificationError) {
        console.error('Error sending task completion notification:', notificationError);
        // Don't fail the update if notifications fail
      }
    }
    
    res.json({
      message: `Task marked as ${newCompletionStatus ? 'completed' : 'incomplete'}`,
      completed: newCompletionStatus,
      taskId: id
    });
    
  } catch (error) {
    console.error('Error toggling task completion:', error);
    res.status(500).json({ error: 'Failed to update task completion' });
  }
});

// ========================= TASK-FILE INTEGRATION ENDPOINTS =========================

// POST /api/tasks/:taskId/attach-file - Attach existing file to task
router.post('/:taskId/attach-file', verifyToken, requirePermission(PERMISSIONS.EDIT_TASKS), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    // Get task document
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data();

    // Check task ownership or permissions
    if (taskData.userId !== req.user.uid && taskData.assignedTo !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get file document
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = fileDoc.data();

    // Check if user has access to the file
    if (fileData.uploadedBy !== req.user.uid && !fileData.isPublic) {
      // Check if file is in same workspace
      if (!taskData.workspaceId || taskData.workspaceId !== fileData.workspaceId) {
        return res.status(403).json({ error: 'Access denied to file' });
      }
    }

    // Check if file is already attached
    const currentAttachments = taskData.attachedFiles || [];
    if (currentAttachments.includes(fileId)) {
      return res.status(409).json({ error: 'File already attached to this task' });
    }

    // Update task with new attachment
    await taskDoc.ref.update({
      attachedFiles: admin.firestore.FieldValue.arrayUnion(fileId),
      attachmentCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update file with task reference
    await fileDoc.ref.update({
      linkedTasks: admin.firestore.FieldValue.arrayUnion(taskId),
      taskCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send notification if task is assigned to someone else
    if (taskData.assignedTo && taskData.assignedTo !== req.user.uid) {
      try {
        await notificationHelpers.fileAttachedToTask({
          taskId: taskId,
          taskTitle: taskData.title,
          fileName: fileData.fileName,
          attachedBy: req.user.uid
        }, taskData.assignedTo);
      } catch (notificationError) {
        console.error('Error sending file attachment notification:', notificationError);
      }
    }

    // Send real-time update
    if (taskData.workspaceId) {
      socketService.sendTaskUpdate({
        id: taskId,
        title: taskData.title,
        attachmentCount: (taskData.attachmentCount || 0) + 1
      }, 'file-attached', req.user.uid);
    }

    console.log(`✅ File ${fileId} attached to task ${taskId}`);

    res.json({
      message: 'File attached to task successfully',
      taskId: taskId,
      fileId: fileId,
      fileName: fileData.fileName
    });

  } catch (error) {
    console.error('Error attaching file to task:', error);
    res.status(500).json({ error: 'Failed to attach file to task' });
  }
});

// DELETE /api/tasks/:taskId/detach-file/:fileId - Detach file from task
router.delete('/:taskId/detach-file/:fileId', verifyToken, requirePermission(PERMISSIONS.EDIT_TASKS), async (req, res) => {
  try {
    const { taskId, fileId } = req.params;

    // Get task document
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data();

    // Check task ownership or permissions
    if (taskData.userId !== req.user.uid && taskData.assignedTo !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file is attached
    const currentAttachments = taskData.attachedFiles || [];
    if (!currentAttachments.includes(fileId)) {
      return res.status(404).json({ error: 'File not attached to this task' });
    }

    // Get file document
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update task - remove attachment
    await taskDoc.ref.update({
      attachedFiles: admin.firestore.FieldValue.arrayRemove(fileId),
      attachmentCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update file - remove task reference
    await fileDoc.ref.update({
      linkedTasks: admin.firestore.FieldValue.arrayRemove(taskId),
      taskCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send real-time update
    if (taskData.workspaceId) {
      socketService.sendTaskUpdate({
        id: taskId,
        title: taskData.title,
        attachmentCount: Math.max(0, (taskData.attachmentCount || 1) - 1)
      }, 'file-detached', req.user.uid);
    }

    console.log(`✅ File ${fileId} detached from task ${taskId}`);

    res.json({
      message: 'File detached from task successfully',
      taskId: taskId,
      fileId: fileId
    });

  } catch (error) {
    console.error('Error detaching file from task:', error);
    res.status(500).json({ error: 'Failed to detach file from task' });
  }
});

// GET /api/tasks/:taskId/files - Get all files attached to a task
router.get('/:taskId/files', verifyToken, requirePermission(PERMISSIONS.VIEW_TASKS), async (req, res) => {
  try {
    const { taskId } = req.params;

    // Get task document
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data();

    // Check task access permissions
    if (taskData.userId !== req.user.uid && taskData.assignedTo !== req.user.uid) {
      // Check workspace access if task is in workspace
      if (taskData.workspaceId) {
        // Add workspace member check here if needed
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const attachedFileIds = taskData.attachedFiles || [];
    
    if (attachedFileIds.length === 0) {
      return res.json({ 
        files: [],
        taskId: taskId,
        taskTitle: taskData.title,
        attachmentCount: 0
      });
    }

    // Get all attached files
    const filePromises = attachedFileIds.map(fileId => 
      db.collection('files').doc(fileId).get()
    );

    const fileDocs = await Promise.all(filePromises);
    
    const files = [];
    fileDocs.forEach((doc, index) => {
      if (doc.exists) {
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
          taskCount: data.taskCount || 0
        });
      } else {
        console.warn(`File ${attachedFileIds[index]} referenced in task ${taskId} but not found`);
      }
    });

    res.json({
      files: files,
      taskId: taskId,
      taskTitle: taskData.title,
      attachmentCount: files.length
    });

  } catch (error) {
    console.error('Error fetching task files:', error);
    res.status(500).json({ error: 'Failed to fetch task files' });
  }
});

// POST /api/tasks/:taskId/upload-file - Upload file directly to task
router.post('/:taskId/upload-file', verifyToken, requirePermission(PERMISSIONS.UPLOAD_FILES), async (req, res) => {
  try {
    const { taskId } = req.params;

    // Get task document first
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data();

    // Check task access permissions
    if (taskData.userId !== req.user.uid && taskData.assignedTo !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add taskId to request body for file upload processing
    req.body.taskId = taskId;
    req.body.workspaceId = taskData.workspaceId; // Inherit workspace from task
    req.body.description = req.body.description || `Attached to task: ${taskData.title}`;

    // Forward to file upload handler
    const fileRoutes = require('./files');
    return fileRoutes.post('/upload', verifyToken, requirePermission(PERMISSIONS.UPLOAD_FILES), async (fileReq, fileRes) => {
      // This will be handled by the modified file upload endpoint
      // We'll need to modify the file upload to handle automatic task attachment
    })(req, res);

  } catch (error) {
    console.error('Error uploading file to task:', error);
    res.status(500).json({ error: 'Failed to upload file to task' });
  }
});

module.exports = router;