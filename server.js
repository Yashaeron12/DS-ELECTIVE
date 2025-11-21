const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const { admin, db, auth, storage } = require('./firebaseConfig');

const path = require('path');
  
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

try {
  const bucket = admin.storage().bucket();
  console.log(`Firebase Storage bucket: ${bucket.name}`);
  
  bucket.exists().then(([exists]) => {
    if (exists) {
      console.log('Firebase Storage bucket exists and is accessible');
    } else {
      console.log('Firebase Storage bucket will be created on first upload');
    }
  }).catch(error => {
    console.log('Firebase Storage ready (bucket will be created automatically)');
  });
  
  console.log('Firebase Admin initialized');
} catch (error) {
  console.error('Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
        'http://localhost:5000',
        'https://cloudcollab-3d898.web.app',
        'https://cloudcollab-3d898.firebaseapp.com'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.userId = decodedToken.uid;
    socket.userEmail = decodedToken.email;
    
    console.log(`Socket authenticated: ${socket.userEmail} (${socket.userId})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userEmail} (${socket.id})`);
  
  socket.join(`user:${socket.userId}`);
  
  socket.on('join-workspace', (workspaceId) => {
    socket.join(`workspace:${workspaceId}`);
    console.log(`User ${socket.userEmail} joined workspace: ${workspaceId}`);
  });
  
  socket.on('leave-workspace', (workspaceId) => {
    socket.leave(`workspace:${workspaceId}`);
    console.log(`User ${socket.userEmail} left workspace: ${workspaceId}`);
  });
  
  socket.on('mark-notification-read', async (notificationId) => {
    try {
      const notificationService = require('./services/notificationService');
      await notificationService.markNotificationAsRead(notificationId, socket.userId);
      
      socket.emit('notification-marked-read', { notificationId });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.userEmail} (${socket.id}) - Reason: ${reason}`);
    
    socket.removeAllListeners('join-workspace');
    socket.removeAllListeners('leave-workspace');
    socket.removeAllListeners('mark-notification-read');
    
    console.log(`Cleaned up socket resources for ${socket.userEmail}`);
  });
  
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.userEmail}:`, error);
  });
});

app.set('io', io);

const socketService = require('./services/socketService');
socketService.initializeSocket(io);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? (process.env.ALLOWED_ORIGINS || 'https://cloudcollab-3d898.web.app,https://cloudcollab-3d898.firebaseapp.com').split(',').filter(Boolean)
      : [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:8080',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:8080',
          'http://localhost:5000',
          'https://cloudcollab-3d898.web.app',
          'https://cloudcollab-3d898.firebaseapp.com'
        ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'CloudCollab Backend API Server',
    version: '1.0.0',
    status: 'running',
    documentation: 'See README.md for API documentation',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        testLogin: 'POST /api/auth/test-login'
      },
      tasks: {
        list: 'GET /api/tasks',
        create: 'POST /api/tasks',
        update: 'PUT /api/tasks/:id',
        delete: 'DELETE /api/tasks/:id',
        toggleComplete: 'PATCH /api/tasks/:id/complete'
      },
      files: {
        list: 'GET /api/files',
        upload: 'POST /api/files/upload',
        download: 'GET /api/files/:id/download',
        update: 'PUT /api/files/:id',
        delete: 'DELETE /api/files/:id',
        share: 'POST /api/files/:id/share',
        sharedWithMe: 'GET /api/files/shared'
      },
      workspaces: {
        list: 'GET /api/workspaces',
        create: 'POST /api/workspaces',
        update: 'PUT /api/workspaces/:id',
        delete: 'DELETE /api/workspaces/:id',
        invite: 'POST /api/workspaces/:id/invite',
        members: 'GET /api/workspaces/:id/members',
        removeMember: 'DELETE /api/workspaces/:id/members/:memberId'
      }
    }
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('Static file serving enabled for uploads directory');

try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('Auth routes loaded successfully');
} catch (error) {
  console.error('Could not load auth routes:', error.message);
}

// Task Routes
try {
  const taskRoutes = require('./routes/tasks');
  app.use('/api/tasks', taskRoutes);
  console.log('Task routes loaded successfully');
} catch (error) {
  console.error('Could not load task routes:', error.message);
}

// File Routes
try {
  const fileRoutes = require('./routes/files');
  app.use('/api/files', fileRoutes);
  console.log('File routes loaded successfully');
} catch (error) {
  console.error('Could not load file routes:', error.message);
}

try {
  const workspaceRoutes = require('./routes/workspaces');
  app.use('/api/workspaces', workspaceRoutes);
  console.log('Workspace routes loaded successfully');
} catch (error) {
  console.error('Could not load workspace routes:', error.message);
}

try {
  const sharingRoutes = require('./routes/sharing');
  app.use('/api/sharing', sharingRoutes);
  app.use('/share', sharingRoutes);
  console.log('File sharing routes loaded successfully');
} catch (error) {
  console.error('Could not load sharing routes:', error.message);
}

// Notification Routes
try {
  const notificationRoutes = require('./routes/notifications');
  app.use('/api/notifications', notificationRoutes);
  console.log('Notification routes loaded successfully');
} catch (error) {
  console.error('Could not load notification routes:', error.message);
}

try {
  const organizationRoutes = require('./routes/organizations');
  app.use('/api/organizations', organizationRoutes);
  console.log('Organization routes loaded successfully');
} catch (error) {
  console.error('Could not load organization routes:', error.message);
}

try {
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('Admin routes loaded successfully');
} catch (error) {
  console.error('Could not load admin routes:', error.message);
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

server.listen(PORT, () => {
  console.log(`CloudCollab API Server started`);
  console.log(`Local URL: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`Socket.IO ready for real-time connections`);
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down server gracefully...');
  server.close(() => {
    console.log('Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down server gracefully...');
  server.close(() => {
    console.log('Server closed successfully');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.log('Server continuing to run...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('Server continuing to run...');
});