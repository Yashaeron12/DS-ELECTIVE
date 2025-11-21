const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { verifyToken } = require('../middleware/auth');
const {
  ROLES,
  PERMISSIONS,
  requireOrganizationPermission,
  getUserOrganizationId,
  getUserOrganizationRole,
  getOrganizationUsers,
  canManageUser,
  canAssignRole,
  getRoleLevel
} = require('../middleware/rbac');

const db = admin.firestore();

router.get('/current', verifyToken, async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.user.uid);
    
    if (!organizationId) {
      return res.status(404).json({ error: 'User not associated with any organization' });
    }
    
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const organizationData = orgDoc.data();
    const userRole = await getUserOrganizationRole(req.user.uid);
    
    res.json({
      organization: {
        id: orgDoc.id,
        ...organizationData
      },
      userRole: userRole
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization details' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    
    const existingOrgId = await getUserOrganizationId(req.user.uid);
    if (existingOrgId) {
      return res.status(400).json({ error: 'User already belongs to an organization' });
    }
    
    const organizationRef = db.collection('organizations').doc();
    const organizationData = {
      name: name.trim(),
      description: description?.trim() || '',
      ownerId: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        allowPublicWorkspaces: false,
        requireApprovalForNewMembers: true
      }
    };
    
    await organizationRef.set(organizationData);
    
    // Update user with organization membership and owner role
    await db.collection('users').doc(req.user.uid).update({
      organizationId: organizationRef.id,
      organizationRole: ROLES.ORG_OWNER,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(201).json({
      message: 'Organization created successfully',
      organization: {
        id: organizationRef.id,
        ...organizationData
      }
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// GET /api/organizations/members - Get all members in current user's organization
router.get('/members', verifyToken, requireOrganizationPermission(PERMISSIONS.VIEW_ORG_MEMBERS), async (req, res) => {
  try {
    const organizationUsers = await getOrganizationUsers(req.user.uid);
    
    // Filter out sensitive information and add additional details
    const members = organizationUsers.map(user => ({
      id: user.id,
      displayName: user.displayName || 'No Name',
      email: user.email,
      role: user.organizationRole || user.role || ROLES.MEMBER,
      isActive: user.isActive !== false,
      joinedAt: user.createdAt,
      lastActiveAt: user.lastActiveAt
    }));
    
    res.json({ members });
  } catch (error) {
    console.error('Error fetching organization members:', error);
    res.status(500).json({ error: 'Failed to fetch organization members' });
  }
});

// PUT /api/organizations/members/:memberId/role - Update member role
router.put('/members/:memberId/role', verifyToken, requireOrganizationPermission(PERMISSIONS.MANAGE_ORG_MEMBERS), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { newRole, reason } = req.body;
    
    if (!newRole || !Object.values(ROLES).includes(newRole)) {
      return res.status(400).json({ error: 'Valid role is required' });
    }
    
    // Check if admin can manage this user
    const canManage = await canManageUser(req.user.uid, memberId);
    if (!canManage) {
      return res.status(403).json({ error: 'Cannot manage this user: insufficient permissions or different organization' });
    }
    
    // Check if admin can assign this role
    const adminRole = await getUserOrganizationRole(req.user.uid);
    if (!canAssignRole(adminRole, newRole)) {
      return res.status(403).json({ error: `Cannot assign ${newRole} role: insufficient permissions` });
    }
    
    // Prevent demoting the organization owner (unless it's a super admin doing it)
    const targetCurrentRole = await getUserOrganizationRole(memberId);
    if (targetCurrentRole === ROLES.ORG_OWNER && adminRole !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Cannot change organization owner role' });
    }
    
    // Update user role
    await db.collection('users').doc(memberId).update({
      organizationRole: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Log the role change
    await db.collection('auditLogs').add({
      type: 'role_change',
      organizationId: req.organizationId,
      adminId: req.user.uid,
      targetUserId: memberId,
      oldRole: targetCurrentRole,
      newRole: newRole,
      reason: reason || 'No reason provided',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ 
      message: 'Role updated successfully',
      newRole: newRole
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// POST /api/organizations/invite - Invite new member to organization
router.post('/invite', verifyToken, requireOrganizationPermission(PERMISSIONS.MANAGE_ORG_MEMBERS), async (req, res) => {
  try {
    const { email, role = ROLES.MEMBER } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    
    // Check if admin can assign this role
    const adminRole = await getUserOrganizationRole(req.user.uid);
    if (!canAssignRole(adminRole, role)) {
      return res.status(403).json({ error: `Cannot assign ${role} role: insufficient permissions` });
    }
    
    // Check if user already exists and belongs to an organization
    const existingUserSnapshot = await db.collection('users').where('email', '==', email.toLowerCase()).get();
    
    if (!existingUserSnapshot.empty) {
      const existingUser = existingUserSnapshot.docs[0];
      const userData = existingUser.data();
      
      if (userData.organizationId && userData.organizationId !== req.organizationId) {
        return res.status(400).json({ error: 'User already belongs to another organization' });
      }
      
      if (userData.organizationId === req.organizationId) {
        return res.status(400).json({ error: 'User is already a member of this organization' });
      }
    }
    
    // Create invitation
    const invitationRef = db.collection('organizationInvitations').doc();
    await invitationRef.set({
      organizationId: req.organizationId,
      email: email.toLowerCase(),
      role: role,
      invitedBy: req.user.uid,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      message: 'Invitation sent successfully',
      invitationId: invitationRef.id
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /api/organizations/available-roles - Get roles that current user can assign
router.get('/available-roles', verifyToken, async (req, res) => {
  try {
    const userRole = await getUserOrganizationRole(req.user.uid);
    const userLevel = getRoleLevel(userRole);
    
    const availableRoles = Object.entries(ROLES)
      .filter(([, role]) => getRoleLevel(role) < userLevel) // Can only assign lower-level roles
      .map(([key, value]) => ({
        value: value,
        name: key.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        description: getRoleDescription(value)
      }));
    
    res.json({ availableRoles });
  } catch (error) {
    console.error('Error fetching available roles:', error);
    res.status(500).json({ error: 'Failed to fetch available roles' });
  }
});

// GET /api/organizations/invitations - Get pending invitations for current user
router.get('/invitations', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email || '';
    
    // Get pending invitations for this user's email
    // Use a simpler query that doesn't require composite index
    const invitationsSnapshot = await db.collection('organizationInvitations')
      .where('email', '==', userEmail.toLowerCase())
      .where('status', '==', 'pending')
      .get();
    
    // Filter by expiration in application code instead of query
    const now = new Date();
    const validInvitations = [];
    
    for (const doc of invitationsSnapshot.docs) {
      const invitationData = doc.data();
      
      // Check if expired
      const expiresAt = invitationData.expiresAt?.toDate ? invitationData.expiresAt.toDate() : new Date(invitationData.expiresAt);
      if (expiresAt <= now) {
        // Mark as expired
        await db.collection('organizationInvitations').doc(doc.id).update({
          status: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        continue; // Skip expired invitations
      }
      
      // Get organization details
      const orgDoc = await db.collection('organizations').doc(invitationData.organizationId).get();
      if (!orgDoc.exists) continue;
      
      const orgData = orgDoc.data();
      
      // Get inviter details
      const inviterDoc = await db.collection('users').doc(invitationData.invitedBy).get();
      const inviterData = inviterDoc.exists ? inviterDoc.data() : {};
      
      validInvitations.push({
        id: doc.id,
        organization: {
          id: invitationData.organizationId,
          name: orgData.name,
          description: orgData.description
        },
        role: invitationData.role,
        invitedBy: {
          displayName: inviterData.displayName || 'Unknown',
          email: inviterData.email || 'Unknown'
        },
        createdAt: invitationData.createdAt,
        expiresAt: invitationData.expiresAt
      });
    }
    
    res.json({ invitations: validInvitations });
  } catch (error) {
    console.error('Error fetching organization invitations:', error);
    // Return empty invitations instead of error to prevent registration blocking
    res.json({ invitations: [] });
  }
});

// POST /api/organizations/invitations/:invitationId/accept - Accept organization invitation
router.post('/invitations/:invitationId/accept', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.uid;
    const userEmail = req.user.email || '';
    
    // Check if user already belongs to an organization
    const existingOrgId = await getUserOrganizationId(userId);
    if (existingOrgId) {
      return res.status(400).json({ error: 'You already belong to an organization. Please leave your current organization first.' });
    }
    
    // Get the invitation
    const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();
    
    if (!invitationDoc.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    const invitationData = invitationDoc.data();
    
    // Validate invitation
    if (invitationData.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation is no longer pending' });
    }
    
    if (invitationData.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation is not for your email address' });
    }
    
    if (new Date() > invitationData.expiresAt.toDate()) {
      // Mark invitation as expired
      await db.collection('organizationInvitations').doc(invitationId).update({
        status: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ error: 'Invitation has expired' });
    }
    
    // Verify organization still exists
    const orgDoc = await db.collection('organizations').doc(invitationData.organizationId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ error: 'Organization no longer exists' });
    }
    
    // Accept the invitation - update user's organization membership
    await db.collection('users').doc(userId).update({
      organizationId: invitationData.organizationId,
      organizationRole: invitationData.role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Mark invitation as accepted
    await db.collection('organizationInvitations').doc(invitationId).update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Log the organization join
    await db.collection('auditLogs').add({
      type: 'organization_join',
      organizationId: invitationData.organizationId,
      userId: userId,
      invitationId: invitationId,
      role: invitationData.role,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const orgData = orgDoc.data();
    
    res.json({
      message: 'Invitation accepted successfully',
      organization: {
        id: invitationData.organizationId,
        name: orgData.name,
        description: orgData.description
      },
      role: invitationData.role
    });
    
  } catch (error) {
    console.error('Error accepting organization invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// POST /api/organizations/invitations/:invitationId/decline - Decline organization invitation
router.post('/invitations/:invitationId/decline', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userEmail = req.user.email || '';
    
    // Get the invitation
    const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();
    
    if (!invitationDoc.exists) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    
    const invitationData = invitationDoc.data();
    
    // Validate invitation
    if (invitationData.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation is no longer pending' });
    }
    
    if (invitationData.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation is not for your email address' });
    }
    
    // Mark invitation as declined
    await db.collection('organizationInvitations').doc(invitationId).update({
      status: 'declined',
      declinedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ message: 'Invitation declined successfully' });
    
  } catch (error) {
    console.error('Error declining organization invitation:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// Helper function to get role descriptions
function getRoleDescription(role) {
  const descriptions = {
    [ROLES.ORG_OWNER]: 'Full control over organization and all workspaces',
    [ROLES.ORG_ADMIN]: 'Can manage organization workspaces and members',
    [ROLES.WORKSPACE_ADMIN]: 'Can manage specific workspaces and their members',
    [ROLES.MANAGER]: 'Can manage tasks and files within workspaces',
    [ROLES.MEMBER]: 'Can participate in workspaces and create content',
    [ROLES.VIEWER]: 'Can view content but not modify anything'
  };
  return descriptions[role] || 'Standard user permissions';
}

module.exports = router;