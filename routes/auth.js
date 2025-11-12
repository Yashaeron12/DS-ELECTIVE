// routes/auth.js - Authentication routes for CloudCollab
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const { ROLES, PERMISSIONS, requirePermission } = require('../middleware/rbac');
const { verifyToken } = require('../middleware/auth');
const { getUserSystemRole, canAssignRole } = require('../middleware/rbac');

// Ensure demo user exists on startup
const ensureDemoUser = async () => {
  try {
    const demoEmail = 'demo@cloudcollab.com';
    let userRecord;
    
    try {
      // Check if demo user already exists
      userRecord = await admin.auth().getUserByEmail(demoEmail);
      console.log('✅ Demo user already exists');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create demo user
        console.log('Creating demo user...');
        userRecord = await admin.auth().createUser({
          email: demoEmail,
          password: 'demo123',
          displayName: 'Demo User',
          emailVerified: true,
          disabled: false
        });
        
        // Create demo organization first
        const db = admin.firestore();
        const demoOrgRef = db.collection('organizations').doc();
        await demoOrgRef.set({
          name: 'Demo Organization',
          description: 'Demo organization for testing CloudCollab features',
          ownerId: userRecord.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          settings: {
            allowPublicWorkspaces: true,
            requireApprovalForNewMembers: false
          }
        });
        
        // Create user document in Firestore
        await db.collection('users').doc(userRecord.uid).set({
          email: demoEmail,
          displayName: 'Demo User',
          // Never store passwords in Firestore - Firebase Auth handles authentication
          role: ROLES.MEMBER, // System role
          organizationId: demoOrgRef.id, // Demo organization
          organizationRole: ROLES.ORG_OWNER, // Organization owner
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true
        });
        
        console.log('✅ Demo user created successfully');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error ensuring demo user:', error);
  }
};

// Initialize demo user
ensureDemoUser();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Validate input
    if (!email || !password || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and display name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    console.log('Creating user in Firebase Auth...');
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false,
      disabled: false
    });

    console.log(`User created: ${userRecord.uid}`);

    // Create simple JWT token for immediate use
    const token = Buffer.from(JSON.stringify({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    })).toString('base64');

    // Create user document in Firestore with default role
    const db = admin.firestore();
    
    // Check if there are any pending organization invitations for this email
    // Make this non-blocking - if it fails, just continue with registration
    let hasPendingInvitations = false;
    try {
      const invitationsSnapshot = await db.collection('organizationInvitations')
        .where('email', '==', email.toLowerCase())
        .where('status', '==', 'pending')
        .where('expiresAt', '>', new Date())
        .limit(1) // Only check if at least one exists
        .get();
      
      hasPendingInvitations = !invitationsSnapshot.empty;
    } catch (invitationError) {
      // Log but don't fail registration if invitation check fails
      console.log('Note: Could not check for invitations (may need Firebase index):', invitationError.message);
      // Continue with registration anyway
    }
    
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: displayName,
      password: password, // Store password for validation (in production, hash this!)
      role: ROLES.MEMBER, // Default system role for new users
      organizationId: null, // Will be set when user creates/joins organization
      organizationRole: null, // Will be set when user creates/joins organization
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });

    console.log('User saved to Firestore');

    console.log(`✅ New user registered: ${email} (${userRecord.uid})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: token,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: ROLES.MEMBER,
        hasPendingInvitations: hasPendingInvitations
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    // Handle specific Firebase errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    if (error.code === 'auth/weak-password') {
      return res.status(400).json({
        success: false,
        error: 'Password is too weak'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log(`Login attempt for: ${email}`);

    // Check if user exists in Firebase Auth first
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      throw error;
    }

    // Get user data from Firestore to check stored password info
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const userData = userDoc.data();
    
    // For demo purposes, implement password validation
    // In production, you'd use proper password hashing (bcrypt) or Firebase Client SDK
    let passwordValid = false;
    
    if (email === 'demo@cloudcollab.com' && password === 'demo123') {
      passwordValid = true;
    } else if (userData.password) {
      // For other users, check stored password (you should hash passwords in production)
      passwordValid = (userData.password === password);
    } else {
      // If no password stored, reject
      passwordValid = false;
    }

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Create simple JWT token for login
    const token = Buffer.from(JSON.stringify({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    })).toString('base64');
    
    // Update last login time
    await db.collection('users').doc(userRecord.uid).update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get user role (default to MEMBER if not set)
    const userRole = userData.role || ROLES.MEMBER;

    console.log(`✅ User logged in: ${email} (${userRecord.uid}) - Role: ${userRole}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: userRole
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    if (error.code === 'auth/user-not-found') {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    // Get user role from Firestore
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    res.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: userData.role || ROLES.MEMBER
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

// Admin endpoint: Update user role (requires MANAGE_USERS permission)
router.put('/users/:userId/role', verifyToken, requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: ' + Object.values(ROLES).join(', ')
      });
    }

    // Prevent users from elevating themselves to SUPER_ADMIN
    if (role === ROLES.SUPER_ADMIN && req.user.uid === userId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot elevate your own role to SUPER_ADMIN'
      });
    }

    // Check if user can assign the requested role (hierarchy validation)
    const userRole = await getUserSystemRole(req.user.uid);
    if (!canAssignRole(userRole, role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied: Cannot assign role '${role}'. Your role '${userRole}' can only assign roles at or below your level.`
      });
    }

    const db = admin.firestore();
    
    // Check if target user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user role
    await db.collection('users').doc(userId).update({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    });

    console.log(`✅ User role updated: ${userId} -> ${role} (by ${req.user.uid})`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      userId: userId,
      newRole: role
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

// Admin endpoint: Get all users (requires VIEW_USERS permission)
router.get('/users', verifyToken, requirePermission(PERMISSIONS.VIEW_USERS), async (req, res) => {
  try {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    const users = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role || ROLES.MEMBER,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate?.() || null,
        lastLoginAt: data.lastLoginAt?.toDate?.() || null
      });
    });

    res.json({
      success: true,
      users: users,
      totalUsers: users.length
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

module.exports = router;