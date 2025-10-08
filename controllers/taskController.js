// controllers/taskController.js
const admin = require('firebase-admin');
const db = admin.firestore();

// Create a new task
exports.createTask = async (req, res) => {
    try {
        const { title, description, priority, deadline } = req.body;
        const ownerId = req.user.uid;

        if (!title) {
            return res.status(400).send({ error: 'Title is required.' });
        }

        const taskData = {
            title,
            description: description || '',
            priority: priority || 'Medium',
            deadline: deadline || null,
            status: 'To Do',
            ownerId,
            collaborators: [],
            createdAt: new Date().toISOString(),
        };

        const taskRef = await db.collection('tasks').add(taskData);
        res.status(201).send({ message: 'Task created successfully', taskId: taskRef.id });
    } catch (error) {
        res.status(500).send({ error: 'Failed to create task.', details: error.message });
    }
};

// Get all tasks for the logged-in user
exports.getAllTasks = async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const tasksSnapshot = await db.collection('tasks').where('ownerId', '==', ownerId).get();
        const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).send(tasks);
    } catch (error) {
        res.status(500).send({ error: 'Failed to retrieve tasks.', details: error.message });
    }
};

// Update an existing task
exports.updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const ownerId = req.user.uid;
        const doc = await db.collection('tasks').doc(taskId).get();

        if (!doc.exists || doc.data().ownerId !== ownerId) {
            return res.status(403).send({ error: 'Access denied or task not found.' });
        }

        await db.collection('tasks').doc(taskId).update(req.body);
        res.status(200).send({ message: 'Task updated successfully.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update task.', details: error.message });
    }
};

// Delete a task
exports.deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const ownerId = req.user.uid;
        const doc = await db.collection('tasks').doc(taskId).get();

        if (!doc.exists || doc.data().ownerId !== ownerId) {
            return res.status(403).send({ error: 'Access denied or task not found.' });
        }

        await db.collection('tasks').doc(taskId).delete();
        res.status(200).send({ message: 'Task deleted successfully.' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to delete task.', details: error.message });
    }
};