// routes/notifications.js - Notification management routes
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { 
  ROLES, 
  PERMISSIONS, 
  requirePermission 
} = require('../middleware/rbac');
const {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUserNotificationPreferences,
  updateNotificationPreferences,
  getUnreadNotificationCount,
  NOTIFICATION_TYPES,
  PRIORITY_LEVELS
} = require('../services/notificationService');

// GET /api/notifications - Get user notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
      limit = 50, 
      unreadOnly = false, 
      type = null,
      page = 1
    } = req.query;

    const options = {
      limit: Math.min(parseInt(limit), 100), // Cap at 100
      unreadOnly: unreadOnly === 'true',
      type: type || null
    };

    const notifications = await getUserNotifications(req.user.uid, options);
    const unreadCount = await getUnreadNotificationCount(req.user.uid);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: options.limit,
        hasMore: notifications.length === options.limit
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const unreadCount = await getUnreadNotificationCount(req.user.uid);
    
    res.json({
      success: true,
      unreadCount
    });

  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
});

// POST /api/notifications - Create notification (admin only)
router.post('/', verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      priority = PRIORITY_LEVELS.MEDIUM,
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, type, title, message'
      });
    }

    // Validate notification type
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification type',
        validTypes: Object.values(NOTIFICATION_TYPES)
      });
    }

    // Validate priority
    if (!Object.values(PRIORITY_LEVELS).includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority level',
        validPriorities: Object.values(PRIORITY_LEVELS)
      });
    }

    const notificationId = await createNotification({
      userId,
      type,
      title,
      message,
      priority,
      metadata,
      triggeredBy: req.user.uid
    });

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        error: 'Notification creation failed - user may have disabled this notification type'
      });
    }

    // Send real-time notification
    const socketService = require('../services/socketService');
    socketService.sendNotificationToUser(userId, {
      id: notificationId,
      type,
      title,
      message,
      priority,
      metadata,
      createdAt: new Date().toISOString(),
      isRead: false
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notificationId
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification'
    });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await markNotificationAsRead(id, req.user.uid);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    if (error.message === 'Access denied') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const markedCount = await markAllNotificationsAsRead(req.user.uid);
    
    res.json({
      success: true,
      message: `${markedCount} notifications marked as read`,
      markedCount
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await deleteNotification(id, req.user.uid);
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    if (error.message === 'Access denied') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

// GET /api/notifications/preferences - Get user notification preferences
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const preferences = await getUserNotificationPreferences(req.user.uid);
    
    res.json({
      success: true,
      preferences,
      availableTypes: NOTIFICATION_TYPES,
      availablePriorities: PRIORITY_LEVELS
    });

  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification preferences'
    });
  }
});

// PUT /api/notifications/preferences - Update user notification preferences
router.put('/preferences', verifyToken, async (req, res) => {
  try {
    const preferences = req.body;
    
    // Validate preferences structure
    if (typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences format'
      });
    }

    await updateNotificationPreferences(req.user.uid, preferences);
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences'
    });
  }
});

// POST /api/notifications/test - Send test notification (development only)
router.post('/test', verifyToken, async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test notifications not available in production'
      });
    }

    const notificationId = await createNotification({
      userId: req.user.uid,
      type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working correctly.',
      priority: PRIORITY_LEVELS.LOW,
      metadata: {
        isTest: true,
        timestamp: new Date().toISOString()
      },
      triggeredBy: req.user.uid
    });

    if (notificationId) {
      // Send real-time notification
      const socketService = require('../services/socketService');
      socketService.sendNotificationToUser(req.user.uid, {
        id: notificationId,
        type: NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working correctly.',
        priority: PRIORITY_LEVELS.LOW,
        metadata: { isTest: true },
        createdAt: new Date().toISOString(),
        isRead: false
      });
    }

    res.json({
      success: true,
      message: 'Test notification sent',
      notificationId
    });

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

// GET /api/notifications/types - Get available notification types and priorities
router.get('/types', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      notificationTypes: NOTIFICATION_TYPES,
      priorityLevels: PRIORITY_LEVELS,
      descriptions: {
        types: {
          [NOTIFICATION_TYPES.FILE_UPLOADED]: 'When someone uploads a file to a workspace you\'re part of',
          [NOTIFICATION_TYPES.FILE_SHARED]: 'When a file is shared with you',
          [NOTIFICATION_TYPES.TASK_ASSIGNED]: 'When you are assigned a new task',
          [NOTIFICATION_TYPES.TASK_COMPLETED]: 'When a task you created is completed',
          [NOTIFICATION_TYPES.WORKSPACE_INVITE]: 'When you are invited to join a workspace',
          [NOTIFICATION_TYPES.MEMBER_JOINED]: 'When someone joins a workspace you\'re part of',
          [NOTIFICATION_TYPES.ROLE_CHANGED]: 'When your role or permissions change',
          [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: 'System-wide announcements and updates'
        },
        priorities: {
          [PRIORITY_LEVELS.LOW]: 'Low priority notifications (can be batched)',
          [PRIORITY_LEVELS.MEDIUM]: 'Normal priority notifications',
          [PRIORITY_LEVELS.HIGH]: 'Important notifications (immediate delivery)',
          [PRIORITY_LEVELS.URGENT]: 'Critical notifications (immediate delivery + sound)'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching notification types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification types'
    });
  }
});

module.exports = router;