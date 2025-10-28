// routes/tasks.js
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { verifyToken } = require('../middleware/auth');

const db = admin.firestore();

// GET /api/tasks - Get all tasks for authenticated user
router.get('/', verifyToken, async (req, res) => {
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

// POST /api/tasks - Create new task
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, priority = 'medium', dueDate, category = 'general' } = req.body;
    
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
      completed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('tasks').add(taskData);
    
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

// PUT /api/tasks/:id - Update task
router.put('/:id', verifyToken, async (req, res) => {
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

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', verifyToken, async (req, res) => {
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

// PATCH /api/tasks/:id/complete - Toggle task completion (bonus endpoint)
router.patch('/:id/complete', verifyToken, async (req, res) => {
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

module.exports = router;
