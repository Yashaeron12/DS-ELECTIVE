const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { verifyToken } = require('../middleware/auth');
const {
  ROLES,
  PERMISSIONS,
  requireOrganizationPermission,
  getOrganizationUsers,
  canManageUser,
  canAssignRole,
  getUserOrganizationRole,
  getRoleLevel
} = require('../middleware/rbac');

const db = admin.firestore();

router.get('/users', verifyToken, requireOrganizationPermission(PERMISSIONS.VIEW_ORG_MEMBERS), async (req, res) => {
  try {
    const organizationUsers = await getOrganizationUsers(req.user.uid);
    
    const users = organizationUsers.map(user => ({
      id: user.id,
      displayName: user.displayName || 'No Name',
      email: user.email,
      role: user.organizationRole || user.role || ROLES.MEMBER,
      isActive: user.isActive !== false,
      createdAt: user.createdAt?.toDate ? user.createdAt.toDate().toISOString() : user.createdAt,
      lastActiveAt: user.lastActiveAt?.toDate ? user.lastActiveAt.toDate().toISOString() : user.lastActiveAt
    }));
    
    res.json({ 
      users: users,
      total: users.length
    });
  } catch (error) {
    console.error('Error fetching users for admin panel:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:userId/role', verifyToken, requireOrganizationPermission(PERMISSIONS.MANAGE_ORG_MEMBERS), async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole, reason } = req.body;
    
    if (!newRole || !Object.values(ROLES).includes(newRole)) {
      return res.status(400).json({ error: 'Valid role is required' });
    }
    
    const canManage = await canManageUser(req.user.uid, userId);
    if (!canManage) {
      return res.status(403).json({ 
        error: 'Cannot manage this user. Users must be in the same organization and you must have sufficient permissions.' 
      });
    }
    
    const adminRole = await getUserOrganizationRole(req.user.uid);
    if (!canAssignRole(adminRole, newRole)) {
      return res.status(403).json({ 
        error: `Cannot assign ${newRole} role. Your role (${adminRole}) is insufficient.` 
      });
    }
    
    const currentRole = await getUserOrganizationRole(userId);
    
    if (currentRole === ROLES.ORG_OWNER && adminRole !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ 
        error: 'Cannot modify organization owner role' 
      });
    }
    
    // Update the user's role
    await db.collection('users').doc(userId).update({
      organizationRole: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Create audit log entry
    await db.collection('auditLogs').add({
      type: 'admin_role_change',
      organizationId: req.organizationId,
      adminUserId: req.user.uid,
      targetUserId: userId,
      previousRole: currentRole,
      newRole: newRole,
      reason: reason || 'Role updated via admin panel',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Get updated user data
    const updatedUserDoc = await db.collection('users').doc(userId).get();
    const updatedUser = updatedUserDoc.data();
    
    res.json({
      message: 'User role updated successfully',
      user: {
        id: userId,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        role: newRole,
        isActive: updatedUser.isActive
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT /api/admin/users/:userId/status - Update user active status
router.put('/users/:userId/status', verifyToken, requireOrganizationPermission(PERMISSIONS.MANAGE_ORG_MEMBERS), async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean value' });
    }
    
    // Verify admin can manage this user
    const canManage = await canManageUser(req.user.uid, userId);
    if (!canManage) {
      return res.status(403).json({ 
        error: 'Cannot manage this user. Users must be in the same organization and you must have sufficient permissions.' 
      });
    }
    
    // Prevent deactivating organization owner
    const targetRole = await getUserOrganizationRole(userId);
    if (targetRole === ROLES.ORG_OWNER && !isActive) {
      return res.status(403).json({ 
        error: 'Cannot deactivate organization owner' 
      });
    }
    
    // Update user status
    await db.collection('users').doc(userId).update({
      isActive: isActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Create audit log
    await db.collection('auditLogs').add({
      type: 'admin_status_change',
      organizationId: req.organizationId,
      adminUserId: req.user.uid,
      targetUserId: userId,
      action: isActive ? 'activated' : 'deactivated',
      reason: reason || `User ${isActive ? 'activated' : 'deactivated'} via admin panel`,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: isActive
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// GET /api/admin/available-roles - Get roles that current admin can assign
router.get('/available-roles', verifyToken, requireOrganizationPermission(PERMISSIONS.MANAGE_ORG_MEMBERS), async (req, res) => {
  try {
    const adminRole = await getUserOrganizationRole(req.user.uid);
    const adminLevel = getRoleLevel(adminRole);
    
    const availableRoles = Object.entries(ROLES)
      .filter(([, role]) => {
        const roleLevel = getRoleLevel(role);
        return roleLevel < adminLevel && role !== ROLES.SUPER_ADMIN; // Can't assign super admin
      })
      .map(([key, value]) => ({
        value: value,
        description: getRoleDescription(value)
      }));
    
    res.json({ availableRoles });
  } catch (error) {
    console.error('Error fetching available roles:', error);
    res.status(500).json({ error: 'Failed to fetch available roles' });
  }
});

// GET /api/admin/audit-logs - Get organization audit logs
router.get('/audit-logs', verifyToken, requireOrganizationPermission(PERMISSIONS.VIEW_ORG_MEMBERS), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const auditSnapshot = await db.collection('auditLogs')
      .where('organizationId', '==', req.organizationId)
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();
    
    const logs = auditSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toISOString()
    }));
    
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Helper function to get role descriptions
function getRoleDescription(role) {
  const descriptions = {
    [ROLES.ORG_OWNER]: 'Organization owner with full control',
    [ROLES.ORG_ADMIN]: 'Organization administrator',
    [ROLES.WORKSPACE_ADMIN]: 'Workspace administrator', 
    [ROLES.MANAGER]: 'Team manager',
    [ROLES.MEMBER]: 'Regular team member',
    [ROLES.VIEWER]: 'Read-only access'
  };
  return descriptions[role] || 'Standard user';
}

module.exports = router;