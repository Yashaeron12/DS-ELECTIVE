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
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Verify task belongs to user
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists || taskDoc.data().userId !== req.user.uid) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await db.collection('tasks').doc(id).update(updateData);
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify task belongs to user
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists || taskDoc.data().userId !== req.user.uid) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await db.collection('tasks').doc(id).delete();
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
