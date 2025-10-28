// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin
try {
  const serviceAccount = require('./cloudcollab-3d898-firebase-adminsdk-fbsvc-72a59c38b1.json'); // Fixed filename
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'cloudcollab-3d898',
      storageBucket: 'cloudcollab-3d898.appspot.com'
    });
  }
  
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      'http://localhost:5000'
    ];
    
    callback(null, true); // Allow all origins in development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Add PATCH
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
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

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration attempt:', req.body);
    const { email, password, displayName } = req.body;
    
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log('Creating user in Firebase Auth...');
    const userRecord = await admin.auth().createUser({ 
      email, 
      password, 
      displayName 
    });
    console.log('User created:', userRecord.uid);
    
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: userRecord.displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('User saved to Firestore');
    
    res.status(201).json({ 
      message: 'User created successfully', 
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error code:', error.code);
    
    let errorMessage = 'Registration failed';
    
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Email already exists';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email format';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak';
    }
    
    res.status(400).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Replace your login endpoint with this improved version
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      // Get user record
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Create a custom token
      const customToken = await admin.auth().createCustomToken(userRecord.uid, {
        email: userRecord.email,
        displayName: userRecord.displayName
      });
      
      res.status(200).json({ 
        message: 'Login successful', 
        token: customToken,
        customToken: customToken, // For client-side auth
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName
        }
      });
    } catch (authError) {
      console.error('Login error:', authError);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Login failed' });
  }
});

// Test Login Endpoint
app.post('/api/auth/test-login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    console.log('Test login attempt for:', email);
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Create a simple test token
    const testToken = Buffer.from(JSON.stringify({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      exp: Date.now() + (60 * 60 * 1000) // 1 hour
    })).toString('base64');
    
    res.json({
      message: 'Test login successful',
      token: testToken,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });
  } catch (error) {
    console.error('Test login error:', error);
    res.status(401).json({ error: 'User not found' });
  }
});

// Task Routes
try {
  const taskRoutes = require('./routes/tasks');
  app.use('/api/tasks', taskRoutes);
  console.log('✅ Task routes loaded successfully');
} catch (error) {
  console.error('❌ Could not load task routes:', error.message);
}

// File Routes
try {
  const fileRoutes = require('./routes/files');
  app.use('/api/files', fileRoutes);
  console.log('✅ File routes loaded successfully');
} catch (error) {
  console.error('❌ Could not load file routes:', error.message);
}

// Workspace Routes
try {
  const workspaceRoutes = require('./routes/workspaces');
  app.use('/api/workspaces', workspaceRoutes);
  console.log('✅ Workspace routes loaded successfully');
} catch (error) {
  console.error('❌ Could not load workspace routes:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CloudCollab API Server started`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});
