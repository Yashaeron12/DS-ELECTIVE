let io;

function initializeSocket(socketIO) {
  io = socketIO;
  console.log('Socket service initialized');
}

function sendNotificationToUser(userId, notification) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  const room = `user:${userId}`;
  io.to(room).emit('new-notification', notification);
  console.log(`Sent notification to user ${userId}:`, notification.title);
}

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
    
    console.log(`Sent notification to workspace ${workspaceId}:`, notification.title);
  }
}

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
    
    console.log(`Sent activity update to workspace ${workspaceId}:`, activity.type);
  }
}

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
  
  console.log(`Sent status update for user ${userId}: ${status}`);
}

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
  
  console.log(`Sent file update to workspace ${workspaceId}: ${action} - ${fileData.name}`);
}

function sendTaskUpdate(taskData, action, userId) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
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
  
  console.log(`Sent task update: ${action} - ${taskData.title}`);
}

function getWorkspaceConnectedUsers(workspaceId) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return 0;
  }
  
  const room = `workspace:${workspaceId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  return socketsInRoom ? socketsInRoom.size : 0;
}

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

function broadcastSystemAnnouncement(announcement) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  io.emit('system-announcement', {
    ...announcement,
    timestamp: new Date().toISOString()
  });
  
  console.log(`Broadcasted system announcement: ${announcement.title}`);
}

function sendMaintenanceNotification(maintenanceInfo) {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  io.emit('maintenance-mode', {
    ...maintenanceInfo,
    timestamp: new Date().toISOString()
  });
  
  console.log(`Sent maintenance notification: ${maintenanceInfo.message}`);
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