// routes/workspaces.js - Team/Workspace management for collaboration
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { verifyToken } = require('../middleware/auth');

const db = admin.firestore();

// GET /api/workspaces - Get all workspaces for authenticated user
router.get('/', verifyToken, async (req, res) => {
  try {
    // Get workspaces where user is owner or member
    const [ownedSnapshot, memberSnapshot] = await Promise.all([
      db.collection('workspaces')
        .where('ownerId', '==', req.user.uid)
        .get(),
      db.collection('workspaceMembers')
        .where('userId', '==', req.user.uid)
        .get()
    ]);

    const workspaces = [];
    
    // Add owned workspaces
    ownedSnapshot.forEach(doc => {
      const data = doc.data();
      workspaces.push({
        id: doc.id,
        ...data,
        role: 'owner',
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null
      });
    });

    // Add member workspaces
    for (const memberDoc of memberSnapshot.docs) {
      const memberData = memberDoc.data();
      const workspaceDoc = await db.collection('workspaces').doc(memberData.workspaceId).get();
      
      if (workspaceDoc.exists) {
        const workspaceData = workspaceDoc.data();
        workspaces.push({
          id: workspaceDoc.id,
          ...workspaceData,
          role: memberData.role,
          joinedAt: memberData.joinedAt?.toDate?.() || null,
          createdAt: workspaceData.createdAt?.toDate?.() || null,
          updatedAt: workspaceData.updatedAt?.toDate?.() || null
        });
      }
    }

    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// POST /api/workspaces - Create new workspace
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, isPrivate = true } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspaceData = {
      name,
      description: description || '',
      ownerId: req.user.uid,
      isPrivate: Boolean(isPrivate),
      memberCount: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('workspaces').add(workspaceData);

    res.status(201).json({
      id: docRef.id,
      message: 'Workspace created successfully',
      ...workspaceData,
      role: 'owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// PUT /api/workspaces/:id - Update workspace
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPrivate } = req.body;

    // Verify ownership
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();
    if (workspaceData.ownerId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not workspace owner' });
    }

    // Update workspace
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPrivate !== undefined) updateData.isPrivate = Boolean(isPrivate);

    await db.collection('workspaces').doc(id).update(updateData);

    res.json({
      message: 'Workspace updated successfully',
      id: id
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// DELETE /api/workspaces/:id - Delete workspace
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();
    if (workspaceData.ownerId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied: Not workspace owner' });
    }

    // Delete all members
    const membersSnapshot = await db.collection('workspaceMembers')
      .where('workspaceId', '==', id)
      .get();

    const batch = db.batch();
    membersSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete workspace
    batch.delete(db.collection('workspaces').doc(id));
    await batch.commit();

    res.json({
      message: 'Workspace deleted successfully',
      deletedWorkspace: {
        id: id,
        name: workspaceData.name
      }
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// POST /api/workspaces/:id/invite - Invite user to workspace
router.post('/:id/invite', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, role = 'member' } = req.body; // owner, admin, member

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Verify workspace ownership or admin role
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();
    let hasPermission = workspaceData.ownerId === req.user.uid;

    if (!hasPermission) {
      // Check if user is admin
      const memberDoc = await db.collection('workspaceMembers')
        .where('workspaceId', '==', id)
        .where('userId', '==', req.user.uid)
        .where('role', '==', 'admin')
        .get();
      
      hasPermission = !memberDoc.empty;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }

    // Find target user
    let targetUser;
    try {
      targetUser = await admin.auth().getUserByEmail(userEmail);
    } catch (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already a member
    const existingMember = await db.collection('workspaceMembers')
      .where('workspaceId', '==', id)
      .where('userId', '==', targetUser.uid)
      .get();

    if (!existingMember.empty) {
      return res.status(400).json({ error: 'User is already a member of this workspace' });
    }

    // Add member
    const memberData = {
      workspaceId: id,
      userId: targetUser.uid,
      userEmail: targetUser.email,
      displayName: targetUser.displayName || 'Unknown User',
      role: role,
      invitedBy: req.user.uid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('workspaceMembers').add(memberData);

    // Update member count
    await db.collection('workspaces').doc(id).update({
      memberCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      message: 'User invited successfully',
      invitedUser: {
        email: userEmail,
        role: role
      }
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// GET /api/workspaces/:id/members - Get workspace members
router.get('/:id/members', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user has access to workspace
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();
    let hasAccess = workspaceData.ownerId === req.user.uid;

    if (!hasAccess) {
      // Check if user is a member
      const memberDoc = await db.collection('workspaceMembers')
        .where('workspaceId', '==', id)
        .where('userId', '==', req.user.uid)
        .get();
      
      hasAccess = !memberDoc.empty;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all members
    const membersSnapshot = await db.collection('workspaceMembers')
      .where('workspaceId', '==', id)
      .orderBy('joinedAt', 'asc')
      .get();

    const members = [];
    
    // Add owner
    try {
      const ownerUser = await admin.auth().getUser(workspaceData.ownerId);
      members.push({
        userId: ownerUser.uid,
        email: ownerUser.email,
        displayName: ownerUser.displayName || 'Unknown User',
        role: 'owner',
        joinedAt: workspaceData.createdAt?.toDate?.() || null
      });
    } catch (error) {
      console.warn('Could not fetch owner details:', error.message);
    }

    // Add other members
    membersSnapshot.forEach(doc => {
      const data = doc.data();
      members.push({
        memberId: doc.id,
        userId: data.userId,
        email: data.userEmail,
        displayName: data.displayName,
        role: data.role,
        joinedAt: data.joinedAt?.toDate?.() || null
      });
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// DELETE /api/workspaces/:id/members/:memberId - Remove member from workspace
router.delete('/:id/members/:memberId', verifyToken, async (req, res) => {
  try {
    const { id, memberId } = req.params;

    // Verify workspace ownership or admin role
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();
    let hasPermission = workspaceData.ownerId === req.user.uid;

    if (!hasPermission) {
      // Check if user is admin
      const memberDoc = await db.collection('workspaceMembers')
        .where('workspaceId', '==', id)
        .where('userId', '==', req.user.uid)
        .where('role', '==', 'admin')
        .get();
      
      hasPermission = !memberDoc.empty;
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }

    // Remove member
    await db.collection('workspaceMembers').doc(memberId).delete();

    // Update member count
    await db.collection('workspaces').doc(id).update({
      memberCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
