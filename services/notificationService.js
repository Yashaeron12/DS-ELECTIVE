const admin = require('firebase-admin');

const db = admin.firestore();

const NOTIFICATION_TYPES = {
  FILE_UPLOADED: 'file_uploaded',
  FILE_SHARED: 'file_shared',
  FILE_DELETED: 'file_deleted',
  FILE_COMMENT: 'file_comment',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_DUE_SOON: 'task_due_soon',
  TASK_OVERDUE: 'task_overdue',
  TASK_COMMENT: 'task_comment',
  WORKSPACE_INVITE: 'workspace_invite',
  WORKSPACE_REMOVED: 'workspace_removed',
  WORKSPACE_ROLE_CHANGED: 'workspace_role_changed',
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left',
  ROLE_CHANGED: 'role_changed',
  SECURITY_ALERT: 'security_alert',
  SYSTEM_ANNOUNCEMENT: 'system_announcement'
};

const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

async function createNotification(notificationData) {
  try {
    const {
      userId,
      type,
      title,
      message,
      priority = PRIORITY_LEVELS.MEDIUM,
      metadata = {},
      triggeredBy
    } = notificationData;

    if (!userId || !type || !title || !message) {
      throw new Error('Missing required notification fields');
    }

    const userPrefs = await getUserNotificationPreferences(userId);
    if (!userPrefs.enabled || !userPrefs.types[type]) {
      console.log(`Notification ${type} disabled for user ${userId}`);
      return null;
    }

    const notification = {
      userId,
      type,
      title,
      message,
      priority,
      metadata,
      triggeredBy,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      readAt: null
    };

    const docRef = await db.collection('notifications').add(notification);
    
    console.log(`Notification created: ${docRef.id} for user ${userId}`);
    return docRef.id;

  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of notifications
 * @param {boolean} options.unreadOnly - Only return unread notifications
 * @param {string} options.type - Filter by notification type
 * @returns {Promise<Array>} - Array of notifications
 */
async function getUserNotifications(userId, options = {}) {
  try {
    const {
      limit = 50,
      unreadOnly = false,
      type = null
    } = options;

    let query = db.collection('notifications')
      .where('userId', '==', userId);

    // Note: Multiple where clauses with orderBy require composite indexes
    // For now, we'll fetch and sort in memory to avoid index requirements
    if (unreadOnly) {
      query = query.where('isRead', '==', false);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    const notifications = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      notifications.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null,
        readAt: data.readAt?.toDate?.() || null
      });
    });

    // Sort by createdAt in memory (descending - newest first)
    notifications.sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    });

    // Apply limit after sorting
    return notifications.slice(0, limit);

  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<boolean>} - Success status
 */
async function markNotificationAsRead(notificationId, userId) {
  try {
    const notificationRef = db.collection('notifications').doc(notificationId);
    const doc = await notificationRef.get();

    if (!doc.exists) {
      throw new Error('Notification not found');
    }

    const data = doc.data();
    if (data.userId !== userId) {
      throw new Error('Access denied');
    }

    if (!data.isRead) {
      await notificationRef.update({
        isRead: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return true;

  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of notifications marked as read
 */
async function markAllNotificationsAsRead(userId) {
  try {
    const unreadQuery = db.collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false);

    const snapshot = await unreadQuery.get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    return snapshot.size;

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<boolean>} - Success status
 */
async function deleteNotification(notificationId, userId) {
  try {
    const notificationRef = db.collection('notifications').doc(notificationId);
    const doc = await notificationRef.get();

    if (!doc.exists) {
      throw new Error('Notification not found');
    }

    const data = doc.data();
    if (data.userId !== userId) {
      throw new Error('Access denied');
    }

    await notificationRef.delete();
    return true;

  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Get user notification preferences
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User notification preferences
 */
async function getUserNotificationPreferences(userId) {
  try {
    const prefsDoc = await db.collection('notificationPreferences').doc(userId).get();
    
    if (!prefsDoc.exists) {
      // Return default preferences
      return {
        enabled: true,
        types: Object.fromEntries(
          Object.values(NOTIFICATION_TYPES).map(type => [type, true])
        ),
        emailNotifications: false,
        pushNotifications: true,
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        }
      };
    }

    return prefsDoc.data();

  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    throw error;
  }
}

/**
 * Update user notification preferences
 * @param {string} userId - User ID
 * @param {Object} preferences - Updated preferences
 * @returns {Promise<boolean>} - Success status
 */
async function updateNotificationPreferences(userId, preferences) {
  try {
    const prefsRef = db.collection('notificationPreferences').doc(userId);
    
    await prefsRef.set({
      ...preferences,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return true;

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Unread notification count
 */
async function getUnreadNotificationCount(userId) {
  try {
    const unreadQuery = db.collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false);

    const snapshot = await unreadQuery.get();
    return snapshot.size;

  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
}

/**
 * Clean up old notifications (older than 30 days)
 * @returns {Promise<number>} - Number of notifications deleted
 */
async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const oldNotificationsQuery = db.collection('notifications')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(500); // Process in batches

    const snapshot = await oldNotificationsQuery.get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;

  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
    throw error;
  }
}

// Notification helper functions for specific events
const notificationHelpers = {
  /**
   * File uploaded notification
   */
  async fileUploaded(fileData, uploaderId, workspaceMembers = []) {
    const notifications = [];
    
    for (const member of workspaceMembers) {
      if (member.userId !== uploaderId) {
        const notificationId = await createNotification({
          userId: member.userId,
          type: NOTIFICATION_TYPES.FILE_UPLOADED,
          title: 'New file uploaded',
          message: `${fileData.uploaderName} uploaded "${fileData.fileName}" to ${fileData.workspaceName}`,
          priority: PRIORITY_LEVELS.MEDIUM,
          metadata: {
            fileId: fileData.id,
            workspaceId: fileData.workspaceId,
            fileName: fileData.fileName
          },
          triggeredBy: uploaderId
        });
        
        if (notificationId) notifications.push(notificationId);
      }
    }
    
    return notifications;
  },

  /**
   * Task assigned notification
   */
  async taskAssigned(taskData, assignerId, assigneeId) {
    if (assignerId === assigneeId) return null;
    
    return await createNotification({
      userId: assigneeId,
      type: NOTIFICATION_TYPES.TASK_ASSIGNED,
      title: 'New task assigned',
      message: `You have been assigned task: "${taskData.title}"`,
      priority: PRIORITY_LEVELS.HIGH,
      metadata: {
        taskId: taskData.id,
        workspaceId: taskData.workspaceId,
        dueDate: taskData.dueDate
      },
      triggeredBy: assignerId
    });
  },

  /**
   * Workspace invitation notification
   */
  async workspaceInvite(workspaceData, inviterId, inviteeId) {
    return await createNotification({
      userId: inviteeId,
      type: NOTIFICATION_TYPES.WORKSPACE_INVITE,
      title: 'Workspace invitation',
      message: `You've been invited to join "${workspaceData.name}" workspace`,
      priority: PRIORITY_LEVELS.HIGH,
      metadata: {
        workspaceId: workspaceData.id,
        workspaceName: workspaceData.name,
        role: workspaceData.role
      },
      triggeredBy: inviterId
    });
  },

  /**
   * Workspace invitation declined notification
   */
  async workspaceInviteDeclined(workspaceData, declinerId, inviterId) {
    return await createNotification({
      userId: inviterId,
      type: NOTIFICATION_TYPES.WORKSPACE_INVITE,
      title: 'Invitation declined',
      message: `${workspaceData.declinedBy} declined your invitation to join "${workspaceData.name}" workspace`,
      priority: PRIORITY_LEVELS.MEDIUM,
      metadata: {
        workspaceId: workspaceData.id,
        workspaceName: workspaceData.name,
        declinedBy: workspaceData.declinedBy
      },
      triggeredBy: declinerId
    });
  },

  /**
   * Member joined workspace notification
   */
  async memberJoined(workspaceData, newMemberId, existingMembers) {
    const notifications = [];
    const newMemberData = await admin.auth().getUser(newMemberId);
    
    for (const member of existingMembers) {
      if (member.userId !== newMemberId) {
        const notificationId = await createNotification({
          userId: member.userId,
          type: NOTIFICATION_TYPES.MEMBER_JOINED,
          title: 'New member joined',
          message: `${newMemberData.displayName || 'A new member'} joined "${workspaceData.name}"`,
          priority: PRIORITY_LEVELS.LOW,
          metadata: {
            workspaceId: workspaceData.id,
            newMemberId: newMemberId,
            memberName: newMemberData.displayName
          },
          triggeredBy: newMemberId
        });
        
        if (notificationId) notifications.push(notificationId);
      }
    }
    
    return notifications;
  },

  /**
   * File attached to task notification
   */
  async fileAttachedToTask(attachmentData, assigneeId) {
    if (attachmentData.attachedBy === assigneeId) return null;
    
    return await createNotification({
      userId: assigneeId,
      type: NOTIFICATION_TYPES.FILE_UPLOADED, // Reusing existing type
      title: 'File attached to your task',
      message: `"${attachmentData.fileName}" was attached to task "${attachmentData.taskTitle}"`,
      priority: PRIORITY_LEVELS.MEDIUM,
      metadata: {
        taskId: attachmentData.taskId,
        fileName: attachmentData.fileName,
        taskTitle: attachmentData.taskTitle
      },
      triggeredBy: attachmentData.attachedBy
    });
  },

  /**
   * File uploaded directly to task notification
   */
  async fileUploadedToTask(fileData, taskData, uploaderId, assigneeId) {
    if (uploaderId === assigneeId) return null;
    
    return await createNotification({
      userId: assigneeId,
      type: NOTIFICATION_TYPES.FILE_UPLOADED,
      title: 'File uploaded to your task',
      message: `New file "${fileData.fileName}" uploaded to task "${taskData.title}"`,
      priority: PRIORITY_LEVELS.MEDIUM,
      metadata: {
        taskId: taskData.id,
        fileId: fileData.id,
        fileName: fileData.fileName,
        taskTitle: taskData.title
      },
      triggeredBy: uploaderId
    });
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  PRIORITY_LEVELS,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUserNotificationPreferences,
  updateNotificationPreferences,
  getUnreadNotificationCount,
  cleanupOldNotifications,
  notificationHelpers
};