// routes/tasks.js
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const verifyAuthToken = require('../middleware/authMiddleware');

router.use(verifyAuthToken); // Secure all routes in this file

router.post('/', taskController.createTask);
router.get('/', taskController.getAllTasks);
router.put('/:taskId', taskController.updateTask);
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;