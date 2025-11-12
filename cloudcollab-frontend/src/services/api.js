// src/services/api.js - API service for communicating with CloudCollab backend
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://cloudcollab-backend.onrender.com/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access by clearing tokens
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userDisplayName');
      localStorage.removeItem('userId');
      console.warn('Authentication token expired or invalid');
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH SERVICES ====================
export const authAPI = {
  // Register new user
  register: async ({ email, password, displayName }) => {
    try {
      console.log('API: Attempting registration with backend...');
      const response = await api.post('/auth/register', {
        email,
        password,
        displayName
      });
      
      // If successful, store the auth info
      if (response.data.success && response.data.token) {
        console.log('API: Backend registration successful');
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userDisplayName', displayName);
        localStorage.setItem('userId', response.data.user.uid);
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      console.error('API: Registration failed:', error);
      
      // Handle specific backend errors
      if (error.response?.status === 409) {
        return { success: false, error: 'Email already exists' };
      }
      
      if (error.response?.status === 400) {
        return { success: false, error: error.response.data.error || 'Invalid registration data' };
      }
      
      // For development: if backend is not running, show helpful message
      if (error.code === 'ERR_NETWORK') {
        return { 
          success: false, 
          error: 'Unable to connect to server. Please make sure the backend is running on localhost:5000' 
        };
      }
      
      return { 
        success: false, 
        error: 'Registration failed. Please try again.' 
      };
    }
  },

  // Login user
  login: async (email, password) => {
    try {
      console.log('API: Attempting login with backend...');
      const response = await api.post('/auth/login', {
        email,
        password
      });
      
      // If successful, store the auth info
      if (response.data.success && response.data.token) {
        console.log('API: Backend login successful');
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userDisplayName', response.data.user.displayName || '');
        localStorage.setItem('userId', response.data.user.uid);
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      console.error('API: Login failed:', error);
      
      // Handle specific backend errors
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      if (error.response?.status === 400) {
        return { success: false, error: error.response.data.error || 'Invalid login data' };
      }
      
      // For development: if backend is not running, show helpful message
      if (error.code === 'ERR_NETWORK') {
        return { 
          success: false, 
          error: 'Unable to connect to server. Please make sure the backend is running on localhost:5000' 
        };
      }
      
      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      };
    }
  },
  
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userDisplayName');
    localStorage.removeItem('userId');
  },
  
  getCurrentUser: () => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    const displayName = localStorage.getItem('userDisplayName');
    const userId = localStorage.getItem('userId');
    
    return token ? { 
      email, 
      displayName, 
      uid: userId || 'user-' + Date.now()
    } : null;
  }
};

// ==================== TASK SERVICES ====================
export const taskAPI = {
  // Get all tasks for user
  getTasks: async () => {
    try {
      const response = await api.get('/tasks');
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  // Create new task
  createTask: async (taskData) => {
    try {
      const response = await api.post('/tasks', taskData);
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Update task
  updateTask: async (id, updates) => {
    try {
      const response = await api.put(`/tasks/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating task:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete task
  deleteTask: async (id) => {
    try {
      const response = await api.delete(`/tasks/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting task:', error);
      return { success: false, error: error.message };
    }
  },

  // Toggle task completion
  toggleComplete: async (id) => {
    try {
      const response = await api.patch(`/tasks/${id}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error toggling task completion:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==================== FILE SERVICES ====================
export const fileAPI = {
  // Get all files for user
  getFiles: async (workspaceId = null) => {
    try {
      const params = workspaceId ? { workspaceId } : {};
      // Use the simple endpoint that bypasses index issues
      const response = await api.get('/files/simple', { params });
      // Return the files array from the response
      return response.data.files || [];
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },

  // Upload file
  uploadFile: async (file, workspaceId = null, description = '', taskId = null) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (workspaceId) formData.append('workspaceId', workspaceId);
      if (description) formData.append('description', description);
      if (taskId) formData.append('taskId', taskId);

      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Delete file
  deleteFile: async (id) => {
    try {
      const response = await api.delete(`/files/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  },

  // Share file
  shareFile: async (id, userEmail, permission = 'read') => {
    try {
      const response = await api.post(`/files/${id}/share`, {
        userEmail,
        permission
      });
      return response.data;
    } catch (error) {
      console.error('Error sharing file:', error);
      return { success: false, error: error.message };
    }
  },

  // Get shared files
  getSharedFiles: async () => {
    try {
      const response = await api.get('/files/shared');
      return response.data;
    } catch (error) {
      console.error('Error fetching shared files:', error);
      return [];
    }
  },

  // Get files for a specific task
  getTaskFiles: async (taskId) => {
    try {
      const response = await api.get(`/tasks/${taskId}/files`);
      return response.data;
    } catch (error) {
      console.error('Error fetching task files:', error);
      throw error;
    }
  },

  // Get user storage statistics (only user files, excludes system defaults)
  getStorageStats: async () => {
    try {
      const response = await api.get('/files/storage-stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      // Return default stats if backend is unavailable
      return {
        success: false,
        storage: {
          usedBytes: 0,
          usedMB: 0,
          usedGB: 0,
          limitGB: 10,
          usagePercentage: 0,
          fileCount: 0,
          availableGB: 10
        }
      };
    }
  }
};

// ==================== WORKSPACE SERVICES ====================
export const workspaceAPI = {
  // Get all workspaces for user
  getWorkspaces: async () => {
    try {
      const response = await api.get('/workspaces');
      return response.data;
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      throw error;
    }
  },

  // Create new workspace
  createWorkspace: async (workspaceData) => {
    try {
      const response = await api.post('/workspaces', workspaceData);
      return response.data;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  },

  // Update workspace
  updateWorkspace: async (id, updates) => {
    try {
      const response = await api.put(`/workspaces/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating workspace:', error);
      return { success: false, error: error.message };
    }
  },

  // Delete workspace
  deleteWorkspace: async (id) => {
    try {
      const response = await api.delete(`/workspaces/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting workspace:', error);
      return { success: false, error: error.message };
    }
  },

  // Invite user to workspace
  inviteUser: async (workspaceId, userEmail, role = 'member') => {
    try {
      const response = await api.post(`/workspaces/${workspaceId}/invite`, {
        userEmail,
        role
      });
      return response.data;
    } catch (error) {
      console.error('Error inviting user:', error);
      return { success: false, error: error.message };
    }
  },

  // Get workspace members
  getMembers: async (workspaceId) => {
    try {
      const response = await api.get(`/workspaces/${workspaceId}/members`);
      return response.data;
    } catch (error) {
      console.error('Error fetching members:', error);
      throw error;
    }
  },

  // Remove member from workspace
  removeMember: async (workspaceId, memberId) => {
    try {
      const response = await api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }
  },

  // Get pending invitations for current user
  getPendingInvitations: async () => {
    try {
      const response = await api.get('/workspaces/invitations');
      return response.data;
    } catch (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }
  },

  // Accept workspace invitation
  acceptInvitation: async (invitationId) => {
    try {
      const response = await api.post(`/workspaces/invitations/${invitationId}/accept`);
      return response.data;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  },

  // Decline workspace invitation
  declineInvitation: async (invitationId) => {
    try {
      const response = await api.post(`/workspaces/invitations/${invitationId}/decline`);
      return response.data;
    } catch (error) {
      console.error('Error declining invitation:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==================== NOTIFICATION SERVICES ====================
export const notificationAPI = {
  // Get user notifications
  getNotifications: async (options = {}) => {
    try {
      const response = await api.get('/notifications', { params: options });
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },

  // Get unread notification count
  getUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const response = await api.patch('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  // Delete notification
  deleteNotification: async (notificationId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Get notification preferences
  getPreferences: async () => {
    try {
      const response = await api.get('/notifications/preferences');
      return response.data;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      throw error;
    }
  },

  // Update notification preferences
  updatePreferences: async (preferences) => {
    try {
      const response = await api.put('/notifications/preferences', preferences);
      return response.data;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  },

  // Send test notification (development only)
  sendTestNotification: async () => {
    try {
      const response = await api.post('/notifications/test');
      return response.data;
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  },

  // Get notification types and descriptions
  getNotificationTypes: async () => {
    try {
      const response = await api.get('/notifications/types');
      return response.data;
    } catch (error) {
      console.error('Error fetching notification types:', error);
      throw error;
    }
  },

  // Create notification (admin only)
  createNotification: async (notificationData) => {
    try {
      const response = await api.post('/notifications', notificationData);
      return response.data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }
};

// ==================== ADMIN SERVICES ====================
export const adminAPI = {
  // Get all users (Admin only)
  getUsers: async (page = 1, limit = 20, role = null, search = '') => {
    try {
      const params = { page, limit };
      if (role) params.role = role;
      if (search) params.search = search;
      
      const response = await api.get('/admin/users', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Update user role (Organization Admin only)
  updateUserRole: async (userId, newRole, reason = '') => {
    try {
      const response = await api.put(`/admin/users/${userId}/role`, {
        newRole,
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Update user status (Admin only)
  updateUserStatus: async (userId, isActive, reason = '') => {
    try {
      const response = await api.put(`/admin/users/${userId}/status`, {
        isActive,
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  },

  // Get available roles (Organization Admin only)
  getAvailableRoles: async () => {
    try {
      const response = await api.get('/admin/available-roles');
      return response.data;
    } catch (error) {
      console.error('Error fetching available roles:', error);
      throw error;
    }
  },

  // Get audit logs (Super Admin only)
  getAuditLogs: async (page = 1, limit = 50, action = null, userId = null) => {
    try {
      const params = { page, limit };
      if (action) params.action = action;
      if (userId) params.userId = userId;
      
      const response = await api.get('/admin/audit-logs', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }
};

// ==================== ORGANIZATION SERVICES ====================
export const organizationAPI = {
  // Get current organization details
  getCurrent: async () => {
    try {
      const response = await api.get('/organizations/current');
      return response.data;
    } catch (error) {
      console.error('Error fetching organization:', error);
      throw error;
    }
  },

  // Create new organization
  create: async (name, description = '') => {
    try {
      const response = await api.post('/organizations', {
        name,
        description
      });
      return response.data;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  },

  // Get organization members
  getMembers: async () => {
    try {
      const response = await api.get('/organizations/members');
      return response.data;
    } catch (error) {
      console.error('Error fetching organization members:', error);
      throw error;
    }
  },

  // Update member role
  updateMemberRole: async (memberId, newRole, reason = '') => {
    try {
      const response = await api.put(`/organizations/members/${memberId}/role`, {
        newRole,
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error updating member role:', error);
      throw error;
    }
  },

  // Invite new member
  inviteMember: async (email, role = 'member') => {
    try {
      const response = await api.post('/organizations/invite', {
        email,
        role
      });
      return response.data;
    } catch (error) {
      console.error('Error inviting member:', error);
      throw error;
    }
  },

  // Get available roles
  getAvailableRoles: async () => {
    try {
      const response = await api.get('/organizations/available-roles');
      return response.data;
    } catch (error) {
      console.error('Error fetching available roles:', error);
      throw error;
    }
  },

  // Get pending invitations for current user
  getInvitations: async () => {
    try {
      const response = await api.get('/organizations/invitations');
      return response.data;
    } catch (error) {
      console.error('Error fetching organization invitations:', error);
      throw error;
    }
  },

  // Accept organization invitation
  acceptInvitation: async (invitationId) => {
    try {
      const response = await api.post(`/organizations/invitations/${invitationId}/accept`);
      return response.data;
    } catch (error) {
      console.error('Error accepting organization invitation:', error);
      throw error;
    }
  },

  // Decline organization invitation
  declineInvitation: async (invitationId) => {
    try {
      const response = await api.post(`/organizations/invitations/${invitationId}/decline`);
      return response.data;
    } catch (error) {
      console.error('Error declining organization invitation:', error);
      throw error;
    }
  }
};

export default api;