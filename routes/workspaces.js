const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { verifyToken } = require('../middleware/auth');
const { 
  ROLES, 
  PERMISSIONS, 
  requirePermission, 
  requireOrganizationPermission,
  requireWorkspacePermission, 
  requireOwnershipOrRole,
  getUserWorkspaceRole,
  getUserOrganizationId,
  canAssignRole
} = require('../middleware/rbac');
const { notificationHelpers } = require('../services/notificationService');
const socketService = require('../services/socketService');

const db = admin.firestore();

router.get('/', verifyToken, requireOrganizationPermission(PERMISSIONS.VIEW_WORKSPACES), async (req, res) => {
  try {
    console.log(`📋 Fetching workspaces for user: ${req.user.uid}, organization: ${req.organizationId}`);
    
    const [ownedSnapshot, memberSnapshot] = await Promise.all([
      db.collection('workspaces')
        .where('organizationId', '==', req.organizationId)
        .where('ownerId', '==', req.user.uid)
        .get(),
      db.collection('workspaceMembers')
        .where('userId', '==', req.user.uid)
        .get()
    ]);

    const workspaces = [];
    
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

    for (const memberDoc of memberSnapshot.docs) {
      const memberData = memberDoc.data();
      const workspaceDoc = await db.collection('workspaces').doc(memberData.workspaceId).get();
      
      if (workspaceDoc.exists) {
        const workspaceData = workspaceDoc.data();
        if (workspaceData.organizationId === req.organizationId) {
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
    }

    console.log(`✅ Found ${workspaces.length} workspaces for user`);
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

router.post('/', verifyToken, requireOrganizationPermission(PERMISSIONS.CREATE_WORKSPACES), async (req, res) => {
  try {
    const { name, description, isPrivate = true } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspaceData = {
      name,
      description: description || '',
      ownerId: req.user.uid,
      organizationId: req.organizationId, // Associate workspace with user's organization
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

// PUT /api/workspaces/:id - Update workspace (requires ownership OR ADMIN+ role)
router.put('/:id', verifyToken, requireWorkspacePermission(PERMISSIONS.EDIT_WORKSPACES), async (req, res) => {
  try {
    // Workspace permission is already verified by middleware
    const { id } = req.params;
    const { name, description, isPrivate } = req.body;

    // Get workspace document
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
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

// DELETE /api/workspaces/:id - Delete workspace (requires ownership OR ADMIN+ role)
router.delete('/:id', verifyToken, requireWorkspacePermission(PERMISSIONS.DELETE_WORKSPACES), async (req, res) => {
  try {
    // Workspace permission is already verified by middleware
    const { id } = req.params;

    // Get workspace document
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();

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

// POST /api/workspaces/:id/invite - Send invitation to user (requires MANAGE_MEMBERS permission)
router.post('/:id/invite', verifyToken, requireWorkspacePermission(PERMISSIONS.MANAGE_MEMBERS), async (req, res) => {
  try {
    // Permission is already verified by middleware
    const { id } = req.params;
    const { userEmail, role = 'member' } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Validate role
    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      });
    }

    // Get inviter's role to check if they can assign the requested role
    const inviterRole = await getUserWorkspaceRole(req.user.uid, id);
    if (!canAssignRole(inviterRole, role)) {
      return res.status(403).json({ 
        error: `Access denied: Cannot assign role '${role}'. Your role '${inviterRole}' can only assign roles at or below your level.`
      });
    }

    // Get workspace document
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();

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

    // Check if there's already a pending invitation
    const existingInvitation = await db.collection('workspaceInvitations')
      .where('workspaceId', '==', id)
      .where('inviteeId', '==', targetUser.uid)
      .where('status', '==', 'pending')
      .get();

    if (!existingInvitation.empty) {
      return res.status(400).json({ error: 'User already has a pending invitation to this workspace' });
    }

    // Create invitation record
    console.log(`📨 Creating invitation for ${userEmail} to workspace ${workspaceData.name} with role ${role}`);
    
    const invitationData = {
      workspaceId: id,
      workspaceName: workspaceData.name,
      inviterId: req.user.uid,
      inviterEmail: req.user.email || 'Unknown',
      inviteeId: targetUser.uid,
      inviteeEmail: targetUser.email,
      role: role,
      status: 'pending', // pending, accepted, declined, expired
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.FieldValue.serverTimestamp() // Set to 7 days from now
    };

    const invitationRef = await db.collection('workspaceInvitations').add(invitationData);
    console.log(`✅ Invitation created with ID: ${invitationRef.id}`);

    // Send workspace invitation notification with invitation ID for actions
    try {
      await notificationHelpers.workspaceInvite({
        id: id,
        name: workspaceData.name,
        role: role,
        invitationId: invitationRef.id
      }, req.user.uid, targetUser.uid);

      // Send real-time workspace activity update
      socketService.sendWorkspaceActivity(id, {
        type: 'invitation_sent',
        inviteeEmail: userEmail,
        inviteeRole: role,
        invitedBy: req.user.uid
      }, req.user.uid);
    } catch (notificationError) {
      console.error('Error sending workspace invitation notifications:', notificationError);
      // Don't fail the invitation if notifications fail
    }

    res.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitationRef.id,
        inviteeEmail: userEmail,
        role: role,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// POST /api/workspaces/invitations/:invitationId/accept - Accept workspace invitation
router.post('/invitations/:invitationId/accept', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;

    // Get invitation
    const invitationDoc = await db.collection('workspaceInvitations').doc(invitationId).get();
    if (!invitationDoc.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitationData = invitationDoc.data();

    // Verify the invitation is for the current user
    if (invitationData.inviteeId !== req.user.uid) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    // Check if invitation is still pending
    if (invitationData.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation is no longer pending' });
    }

    // Check if invitation has expired (7 days)
    const invitationDate = invitationData.createdAt?.toDate();
    const now = new Date();
    const daysDiff = (now - invitationDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 7) {
      // Mark invitation as expired
      await db.collection('workspaceInvitations').doc(invitationId).update({
        status: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if user is already a member
    const existingMember = await db.collection('workspaceMembers')
      .where('workspaceId', '==', invitationData.workspaceId)
      .where('userId', '==', req.user.uid)
      .get();

    if (!existingMember.empty) {
      // Mark invitation as accepted anyway
      await db.collection('workspaceInvitations').doc(invitationId).update({
        status: 'accepted',
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ error: 'You are already a member of this workspace' });
    }

    // Add user as workspace member
    const memberData = {
      workspaceId: invitationData.workspaceId,
      userId: req.user.uid,
      userEmail: req.user.email,
      displayName: req.user.displayName || 'Unknown User',
      role: invitationData.role,
      invitedBy: invitationData.inviterId,
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('workspaceMembers').add(memberData);

    // Update invitation status
    await db.collection('workspaceInvitations').doc(invitationId).update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update workspace member count
    await db.collection('workspaces').doc(invitationData.workspaceId).update({
      memberCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send notifications to existing members
    try {
      const existingMembersSnapshot = await db.collection('workspaceMembers')
        .where('workspaceId', '==', invitationData.workspaceId)
        .get();
      
      const existingMembers = [];
      existingMembersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId !== req.user.uid) {
          existingMembers.push({ userId: data.userId });
        }
      });
      
      // Add workspace owner to existing members
      const workspaceDoc = await db.collection('workspaces').doc(invitationData.workspaceId).get();
      if (workspaceDoc.exists) {
        const workspaceData = workspaceDoc.data();
        if (workspaceData.ownerId !== req.user.uid) {
          existingMembers.push({ userId: workspaceData.ownerId });
        }
      }
      
      // Send member joined notification to existing members
      await notificationHelpers.memberJoined({
        id: invitationData.workspaceId,
        name: invitationData.workspaceName
      }, req.user.uid, existingMembers);

      // Send real-time update
      socketService.sendWorkspaceActivity(invitationData.workspaceId, {
        type: 'member_joined',
        memberEmail: req.user.email,
        memberRole: invitationData.role,
        joinedBy: req.user.uid
      });
    } catch (notificationError) {
      console.error('Error sending member joined notifications:', notificationError);
    }

    res.json({
      message: 'Invitation accepted successfully',
      workspace: {
        id: invitationData.workspaceId,
        name: invitationData.workspaceName,
        role: invitationData.role
      }
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// POST /api/workspaces/invitations/:invitationId/decline - Decline workspace invitation
router.post('/invitations/:invitationId/decline', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;

    // Get invitation
    const invitationDoc = await db.collection('workspaceInvitations').doc(invitationId).get();
    if (!invitationDoc.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitationData = invitationDoc.data();

    // Verify the invitation is for the current user
    if (invitationData.inviteeId !== req.user.uid) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    // Check if invitation is still pending
    if (invitationData.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation is no longer pending' });
    }

    // Update invitation status
    await db.collection('workspaceInvitations').doc(invitationId).update({
      status: 'declined',
      declinedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send notification to inviter
    try {
      await notificationHelpers.workspaceInviteDeclined({
        id: invitationData.workspaceId,
        name: invitationData.workspaceName,
        declinedBy: req.user.email
      }, req.user.uid, invitationData.inviterId);
    } catch (notificationError) {
      console.error('Error sending invitation declined notification:', notificationError);
    }

    res.json({
      message: 'Invitation declined successfully'
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// GET /api/workspaces/invitations - Get pending invitations for current user
router.get('/invitations', verifyToken, async (req, res) => {
  try {
    console.log('📨 Fetching invitations for user:', req.user.uid);
    
    // First get all invitations for the user, then filter and sort in memory to avoid index issues
    const invitationsSnapshot = await db.collection('workspaceInvitations')
      .where('inviteeId', '==', req.user.uid)
      .get();

    const invitations = [];
    invitationsSnapshot.forEach(doc => {
      const data = doc.data();
      // Only include pending invitations
      if (data.status === 'pending') {
        invitations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || null
        });
      }
    });

    // Sort by createdAt in memory (newest first)
    invitations.sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    });

    console.log(`✅ Found ${invitations.length} pending invitations`);
    res.json(invitations);
  } catch (error) {
    console.error('❌ Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// GET /api/workspaces/:id/members - Get workspace members (requires VIEW_MEMBERS permission)
router.get('/:id/members', verifyToken, requireWorkspacePermission(PERMISSIONS.VIEW_MEMBERS), async (req, res) => {
  try {
    // Permission is already verified by middleware
    const { id } = req.params;

    // Get workspace document
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspaceData = workspaceDoc.data();

    // Get all members
    const membersSnapshot = await db.collection('workspaceMembers')
      .where('workspaceId', '==', id)
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

    // Sort members by joinedAt (owner first, then by join date)
    members.sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      if (!a.joinedAt) return 1;
      if (!b.joinedAt) return -1;
      return new Date(a.joinedAt) - new Date(b.joinedAt);
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// DELETE /api/workspaces/:id/members/:memberId - Remove member from workspace (requires MANAGE_MEMBERS permission)
router.delete('/:id/members/:memberId', verifyToken, requireWorkspacePermission(PERMISSIONS.MANAGE_MEMBERS), async (req, res) => {
  try {
    // Permission is already verified by middleware
    const { id, memberId } = req.params;

    // Get workspace document
    const workspaceDoc = await db.collection('workspaces').doc(id).get();
    if (!workspaceDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found' });
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