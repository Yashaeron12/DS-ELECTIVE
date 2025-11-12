// src/services/api.js - API service for communicating with CloudCollab backend
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
      // Let the React app handle the redirect through AuthContext
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userDisplayName');
      localStorage.removeItem('userId');
      localStorage.removeItem('isDemoMode');
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
      const response = await api.post('/auth/register', {
        email,
        password,
        displayName
      });
      
      // If successful, store the auth info
      if (response.data.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userDisplayName', displayName);
        localStorage.setItem('userId', response.data.user.uid);
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      console.warn('Backend not available, using demo mode for registration');
      
      // For demo purposes, always simulate successful registration
      const mockToken = 'demo-token-' + Date.now();
      const userId = 'demo-user-' + Date.now();
      const user = { email, uid: userId, displayName };
      
      // Store auth info
      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('userDisplayName', displayName);
      localStorage.setItem('userId', userId);
      localStorage.setItem('isDemoMode', 'true');
      
      return { 
        success: true, 
        token: mockToken, 
        user: user,
        message: 'Registration successful! Welcome to CloudCollab.'
      };
    }
  },

  // For demo purposes, we'll simulate auth
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password
      });
      
      // If successful, store the auth info
      if (response.data.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userDisplayName', response.data.user.displayName || '');
        localStorage.setItem('userId', response.data.user.uid);
        localStorage.removeItem('isDemoMode');
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      
      // Check if it's a network error (backend not running)
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        console.warn('Backend not available, using demo mode');
        // Simulate successful login for demo
        const mockToken = 'demo-token-' + Date.now();
        const user = { email, uid: 'demo-user-' + Date.now(), displayName: 'Demo User' };
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userDisplayName', user.displayName);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('isDemoMode', 'true');
        return { success: true, token: mockToken, user };
      }
      
      // Handle specific backend errors
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      // Generic error
      return { success: false, error: 'Login failed. Please try again.' };
    }
  },
  
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userDisplayName');
    localStorage.removeItem('userId');
    localStorage.removeItem('isDemoMode');
  },
  
  getCurrentUser: () => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    const displayName = localStorage.getItem('userDisplayName');
    const userId = localStorage.getItem('userId');
    const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
    
    return token ? { 
      email, 
      displayName, 
      uid: userId || 'user-' + Date.now(),
      isDemoMode 
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
      // Return mock data for demo
      return getMockTasks();
    }
  },

  // Create new task
  createTask: async (taskData) => {
    try {
      const response = await api.post('/tasks', taskData);
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      // Return mock response for demo
      return {
        id: Date.now().toString(),
        ...taskData,
        completed: false,
        createdAt: new Date().toISOString()
      };
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
      const response = await api.get('/files', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching files:', error);
      return getMockFiles();
    }
  },

  // Upload file
  uploadFile: async (file, workspaceId = null, description = '') => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (workspaceId) formData.append('workspaceId', workspaceId);
      if (description) formData.append('description', description);

      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      // Return mock response for demo
      return {
        id: Date.now().toString(),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        success: true
      };
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
      return getMockWorkspaces();
    }
  },

  // Create new workspace
  createWorkspace: async (workspaceData) => {
    try {
      const response = await api.post('/workspaces', workspaceData);
      return response.data;
    } catch (error) {
      console.error('Error creating workspace:', error);
      return {
        id: Date.now().toString(),
        ...workspaceData,
        memberCount: 1,
        role: 'owner',
        createdAt: new Date().toISOString()
      };
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
      return getMockMembers();
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
  }
};

// ==================== MOCK DATA FOR DEMO ====================
const getMockTasks = () => {
  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
  const userEmail = localStorage.getItem('userEmail');
  
  // Only show demo data for demo users or if no user is logged in
  if (isDemoMode || userEmail === 'demo@cloudcollab.com') {
    return [
      {
        id: '1',
        title: 'Setup project workspace',
        description: 'Initialize project structure and development environment',
        priority: 'medium',
        category: 'setup',
        completed: false,
        createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: '2',
        title: 'Create sample content',
        description: 'Add initial content to test the application',
        priority: 'low',
        category: 'content',
        completed: true,
        createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
      }
    ];
  }
  
  // Return empty array for new users
  return [];
};

const getMockFiles = () => {
  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
  const userEmail = localStorage.getItem('userEmail');
  
  // Only show demo data for demo users
  if (isDemoMode || userEmail === 'demo@cloudcollab.com') {
    return [
      {
        id: '1',
        fileName: 'README.md',
        fileSize: 2048,
        mimeType: 'text/markdown',
        uploadedAt: new Date(Date.now() - 3600000).toISOString(),
        downloadCount: 1
      },
      {
        id: '2',
        fileName: 'notes.txt',
        fileSize: 512,
        mimeType: 'text/plain',
        uploadedAt: new Date(Date.now() - 1800000).toISOString(),
        downloadCount: 0
      }
    ];
  }
  
  // Return empty array for new users
  return [];
};

const getMockWorkspaces = () => {
  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
  const userEmail = localStorage.getItem('userEmail');
  const displayName = localStorage.getItem('userDisplayName') || 'User';
  
  // Only show demo data for demo users
  if (isDemoMode || userEmail === 'demo@cloudcollab.com') {
    return [
      {
        id: '1',
        name: 'My Workspace',
        description: 'Personal project workspace',
        memberCount: 1,
        role: 'owner',
        isPrivate: true,
        createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];
  }
  
  // Create a default workspace for new users
  return [
    {
      id: '1',
      name: `${displayName}'s Workspace`,
      description: 'Your personal collaboration workspace',
      memberCount: 1,
      role: 'owner',
      isPrivate: true,
      createdAt: new Date().toISOString()
    }
  ];
};

const getMockMembers = () => {
  const userEmail = localStorage.getItem('userEmail');
  const displayName = localStorage.getItem('userDisplayName') || 'User';
  const userId = localStorage.getItem('userId') || 'user-owner';
  
  return [
    {
      userId: userId,
      email: userEmail || 'user@example.com',
      displayName: displayName,
      role: 'owner',
      joinedAt: new Date().toISOString()
    }
  ];
};

export default api;