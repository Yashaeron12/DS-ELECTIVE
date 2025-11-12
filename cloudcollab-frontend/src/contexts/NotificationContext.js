// src/contexts/NotificationContext.js - Context for managing notifications
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { notificationAPI } from '../services/api';
import io from 'socket.io-client';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    enabled: true,
    types: {},
    emailNotifications: false,
    pushNotifications: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  });

  // Initialize Socket.IO connection
  useEffect(() => {
    if (user && token) {
      const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('✅ Connected to notification service');
      });

      newSocket.on('new-notification', (notification) => {
        console.log('📢 New notification received:', notification);
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show browser notification if enabled
        if (preferences.pushNotifications && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/logo192.png',
              badge: '/logo192.png'
            });
          }
        }
      });

      newSocket.on('notification-marked-read', ({ notificationId }) => {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true, readAt: new Date().toISOString() }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      });

      newSocket.on('workspace-activity', (activity) => {
        console.log('📊 Workspace activity:', activity);
        // Handle real-time workspace updates here
      });

      newSocket.on('file-update', (fileUpdate) => {
        console.log('📁 File update:', fileUpdate);
        // Handle real-time file updates here
      });

      newSocket.on('system-announcement', (announcement) => {
        console.log('📢 System announcement:', announcement);
        // Handle system announcements
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      newSocket.on('disconnect', () => {
        console.log('🔌 Disconnected from notification service');
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user, token, preferences.pushNotifications]);

  // Request notification permission
  useEffect(() => {
    if (preferences.pushNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }
    }
  }, [preferences.pushNotifications]);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async (options = {}) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await notificationAPI.getNotifications(options);
      if (response.success) {
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await notificationAPI.getPreferences();
      if (response.success) {
        setPreferences(response.preferences);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  }, [user]);

  // Update notification preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    try {
      const response = await notificationAPI.updatePreferences(newPreferences);
      if (response.success) {
        setPreferences(newPreferences);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return false;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);
      if (response.success) {
        // Emit to socket for real-time update
        if (socket) {
          socket.emit('mark-notification-read', notificationId);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }, [socket]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationAPI.markAllAsRead();
      if (response.success) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const response = await notificationAPI.deleteNotification(notificationId);
      if (response.success) {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }, []);

  // Get unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await notificationAPI.getUnreadCount();
      if (response.success) {
        setUnreadCount(response.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user]);

  // Join workspace room (for real-time updates)
  const joinWorkspace = useCallback((workspaceId) => {
    if (socket) {
      socket.emit('join-workspace', workspaceId);
    }
  }, [socket]);

  // Leave workspace room
  const leaveWorkspace = useCallback((workspaceId) => {
    if (socket) {
      socket.emit('leave-workspace', workspaceId);
    }
  }, [socket]);

  // Send test notification (development only)
  const sendTestNotification = useCallback(async () => {
    try {
      const response = await notificationAPI.sendTestNotification();
      return response.success;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }, []);

  // Initialize data when user logs in
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences();
      fetchUnreadCount();
    }
  }, [user, fetchNotifications, fetchPreferences, fetchUnreadCount]);

  const value = {
    // State
    notifications,
    unreadCount,
    loading,
    preferences,
    socket,
    
    // Actions
    fetchNotifications,
    fetchPreferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchUnreadCount,
    joinWorkspace,
    leaveWorkspace,
    sendTestNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};