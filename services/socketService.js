// services/socketService.js - Socket.IO utility functions for real-time notifications
let io;

/**
 * Initialize Socket.IO instance
 * @param {Object} socketIO - Socket.IO server instance
 */
function initializeSocket(socketIO) {
  io = socketIO;
  console.log('✅ Socket service initialized');
}

/**
 * Send notification to a specific user
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification data
 */
function sendNotificationToUser(userId, notification) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  const room = `user:${userId}`;
  io.to(room).emit('new-notification', notification);
  console.log(`📢 Sent notification to user ${userId}:`, notification.title);
}

/**
 * Send notification to all members of a workspace
 * @param {string} workspaceId - Workspace ID
 * @param {Object} notification - Notification data
 * @param {string} excludeUserId - User ID to exclude from broadcast
 */
function sendNotificationToWorkspace(workspaceId, notification, excludeUserId = null) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  const room = `workspace:${workspaceId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  
  if (socketsInRoom) {
    socketsInRoom.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.userId !== excludeUserId) {
        socket.emit('new-notification', notification);
      }
    });
    
    console.log(`📢 Sent notification to workspace ${workspaceId}:`, notification.title);
  }
}

/**
 * Send real-time activity update to workspace members
 * @param {string} workspaceId - Workspace ID
 * @param {Object} activity - Activity data
 * @param {string} excludeUserId - User ID to exclude from broadcast
 */
function sendWorkspaceActivity(workspaceId, activity, excludeUserId = null) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  const room = `workspace:${workspaceId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  
  if (socketsInRoom) {
    socketsInRoom.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.userId !== excludeUserId) {
        socket.emit('workspace-activity', activity);
      }
    });
    
    console.log(`📊 Sent activity update to workspace ${workspaceId}:`, activity.type);
  }
}

/**
 * Send typing indicator to workspace members
 * @param {string} workspaceId - Workspace ID
 * @param {string} userId - Typing user ID
 * @param {string} userName - Typing user name
 * @param {boolean} isTyping - Whether user is typing
 */
function sendTypingIndicator(workspaceId, userId, userName, isTyping) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  const room = `workspace:${workspaceId}`;
  io.to(room).emit('typing-indicator', {
    userId,
    userName,
    isTyping,
    timestamp: new Date().toISOString()
  });
}

/**
 * Send user status update (online/offline) to relevant workspaces
 * @param {string} userId - User ID
 * @param {string} status - User status (online/offline)
 * @param {Array} workspaceIds - Array of workspace IDs user is part of
 */
function sendUserStatusUpdate(userId, status, workspaceIds = []) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  workspaceIds.forEach(workspaceId => {
    const room = `workspace:${workspaceId}`;
    io.to(room).emit('user-status-change', {
      userId,
      status,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log(`👤 Sent status update for user ${userId}: ${status}`);
}

/**
 * Send file update notification to workspace
 * @param {string} workspaceId - Workspace ID
 * @param {Object} fileData - File data
 * @param {string} action - Action type (uploaded, deleted, shared, etc.)
 * @param {string} userId - User who performed the action
 */
function sendFileUpdate(workspaceId, fileData, action, userId) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  const room = `workspace:${workspaceId}`;
  io.to(room).emit('file-update', {
    fileId: fileData.id,
    fileName: fileData.name,
    action,
    userId,
    timestamp: new Date().toISOString(),
    metadata: fileData
  });
  
  console.log(`📁 Sent file update to workspace ${workspaceId}: ${action} - ${fileData.name}`);
}

/**
 * Send task update notification to assigned users and workspace
 * @param {Object} taskData - Task data
 * @param {string} action - Action type (created, assigned, completed, etc.)
 * @param {string} userId - User who performed the action
 */
function sendTaskUpdate(taskData, action, userId) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  // Send to assigned user if different from action performer
  if (taskData.assignedTo && taskData.assignedTo !== userId) {
    sendNotificationToUser(taskData.assignedTo, {
      type: 'task_update',
      title: `Task ${action}`,
      message: `Task "${taskData.title}" has been ${action}`,
      taskId: taskData.id,
      action,
      timestamp: new Date().toISOString()
    });
  }
  
  // Send to workspace if available
  if (taskData.workspaceId) {
    sendWorkspaceActivity(taskData.workspaceId, {
      type: 'task_update',
      taskId: taskData.id,
      taskTitle: taskData.title,
      action,
      userId,
      timestamp: new Date().toISOString()
    }, userId);
  }
  
  console.log(`✅ Sent task update: ${action} - ${taskData.title}`);
}

/**
 * Get connected users count for a workspace
 * @param {string} workspaceId - Workspace ID
 * @returns {number} - Number of connected users
 */
function getWorkspaceConnectedUsers(workspaceId) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return 0;
  }
  
  const room = `workspace:${workspaceId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  return socketsInRoom ? socketsInRoom.size : 0;
}

/**
 * Get all connected users for a workspace with their details
 * @param {string} workspaceId - Workspace ID
 * @returns {Array} - Array of connected user objects
 */
function getWorkspaceConnectedUserDetails(workspaceId) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return [];
  }
  
  const room = `workspace:${workspaceId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  const connectedUsers = [];
  
  if (socketsInRoom) {
    socketsInRoom.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.userId) {
        const existingUser = connectedUsers.find(user => user.userId === socket.userId);
        if (!existingUser) {
          connectedUsers.push({
            userId: socket.userId,
            userEmail: socket.userEmail,
            connectedAt: socket.connectedAt || new Date().toISOString(),
            socketId: socketId
          });
        }
      }
    });
  }
  
  return connectedUsers;
}

/**
 * Broadcast system announcement to all connected users
 * @param {Object} announcement - Announcement data
 */
function broadcastSystemAnnouncement(announcement) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  io.emit('system-announcement', {
    ...announcement,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📢 Broadcasted system announcement: ${announcement.title}`);
}

/**
 * Send maintenance mode notification to all users
 * @param {Object} maintenanceInfo - Maintenance information
 */
function sendMaintenanceNotification(maintenanceInfo) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  io.emit('maintenance-mode', {
    ...maintenanceInfo,
    timestamp: new Date().toISOString()
  });
  
  console.log(`🔧 Sent maintenance notification: ${maintenanceInfo.message}`);
}

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendNotificationToWorkspace,
  sendWorkspaceActivity,
  sendTypingIndicator,
  sendUserStatusUpdate,
  sendFileUpdate,
  sendTaskUpdate,
  getWorkspaceConnectedUsers,
  getWorkspaceConnectedUserDetails,
  broadcastSystemAnnouncement,
  sendMaintenanceNotification
};