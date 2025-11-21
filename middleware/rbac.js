const admin = require('firebase-admin');
const db = admin.firestore();

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_OWNER: 'org_owner',
  ORG_ADMIN: 'org_admin',
  WORKSPACE_ADMIN: 'workspace_admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

const PERMISSIONS = {
  MANAGE_SYSTEM: 'manage_system',
  MANAGE_ORGANIZATION: 'manage_organization',
  CREATE_ORGANIZATION: 'create_organization',
  DELETE_ORGANIZATION: 'delete_organization',
  MANAGE_ORG_MEMBERS: 'manage_org_members',
  VIEW_ORG_MEMBERS: 'view_org_members',
  CREATE_WORKSPACES: 'create_workspaces',
  EDIT_WORKSPACES: 'edit_workspaces',
  DELETE_WORKSPACES: 'delete_workspaces',
  VIEW_WORKSPACES: 'view_workspaces',
  MANAGE_MEMBERS: 'manage_members',
  VIEW_MEMBERS: 'view_members',
  UPLOAD_FILES: 'upload_files',
  DELETE_FILES: 'delete_files',
  SHARE_FILES: 'share_files',
  VIEW_FILES: 'view_files',
  CREATE_TASKS: 'create_tasks',
  ASSIGN_TASKS: 'assign_tasks',
  DELETE_TASKS: 'delete_tasks',
  VIEW_TASKS: 'view_tasks',
  CREATE_WORKSPACE: 'create_workspaces',
  DELETE_WORKSPACE: 'delete_workspaces',
  MANAGE_WORKSPACE: 'edit_workspaces',
  VIEW_WORKSPACE: 'view_workspaces',
  INVITE_MEMBERS: 'manage_members',
  REMOVE_MEMBERS: 'manage_members',
  MANAGE_ROLES: 'manage_members'
};

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  
  [ROLES.ORG_OWNER]: [
    PERMISSIONS.MANAGE_ORGANIZATION,
    PERMISSIONS.MANAGE_ORG_MEMBERS,
    PERMISSIONS.VIEW_ORG_MEMBERS,
    PERMISSIONS.CREATE_WORKSPACES,
    PERMISSIONS.EDIT_WORKSPACES,
    PERMISSIONS.DELETE_WORKSPACES,
    PERMISSIONS.VIEW_WORKSPACES,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    PERMISSIONS.SHARE_FILES,
    PERMISSIONS.VIEW_FILES,
    PERMISSIONS.CREATE_TASKS,
    PERMISSIONS.ASSIGN_TASKS,
    PERMISSIONS.DELETE_TASKS,
    PERMISSIONS.VIEW_TASKS
  ],
  
  [ROLES.ORG_ADMIN]: [
    PERMISSIONS.VIEW_ORG_MEMBERS,
    PERMISSIONS.CREATE_WORKSPACES,
    PERMISSIONS.EDIT_WORKSPACES,
    PERMISSIONS.DELETE_WORKSPACES,
    PERMISSIONS.VIEW_WORKSPACES,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    PERMISSIONS.SHARE_FILES,
    PERMISSIONS.VIEW_FILES,
    PERMISSIONS.CREATE_TASKS,
    PERMISSIONS.ASSIGN_TASKS,
    PERMISSIONS.DELETE_TASKS,
    PERMISSIONS.VIEW_TASKS
  ],
  
  [ROLES.WORKSPACE_ADMIN]: [
    PERMISSIONS.EDIT_WORKSPACES,
    PERMISSIONS.VIEW_WORKSPACES,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    PERMISSIONS.SHARE_FILES,
    PERMISSIONS.VIEW_FILES,
    PERMISSIONS.CREATE_TASKS,
    PERMISSIONS.ASSIGN_TASKS,
    PERMISSIONS.DELETE_TASKS,
    PERMISSIONS.VIEW_TASKS
  ],
  
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_WORKSPACES,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    PERMISSIONS.SHARE_FILES,
    PERMISSIONS.VIEW_FILES,
    PERMISSIONS.CREATE_TASKS,
    PERMISSIONS.ASSIGN_TASKS,
    PERMISSIONS.VIEW_TASKS
  ],
  
  [ROLES.MEMBER]: [
    PERMISSIONS.VIEW_WORKSPACES,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.VIEW_FILES,
    PERMISSIONS.CREATE_TASKS,
    PERMISSIONS.VIEW_TASKS
  ],
  
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_WORKSPACES,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.VIEW_FILES,
    PERMISSIONS.VIEW_TASKS
  ]
};

// Get user's organization ID
const getUserOrganizationId = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().organizationId || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user organization:', error);
    return null;
  }
};

// Get user's role within their organization
const getUserOrganizationRole = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const role = userData.organizationRole || userData.role || ROLES.MEMBER;
      // Normalize to lowercase for case-insensitive comparison
      return role ? role.toLowerCase() : ROLES.MEMBER;
    }
    return ROLES.MEMBER;
  } catch (error) {
    console.error('Error getting user organization role:', error);
    return ROLES.MEMBER;
  }
};

// Get user's role in a specific workspace
const getUserWorkspaceRole = async (userId, workspaceId) => {
  try {
    // Check if user is workspace owner
    const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (workspaceDoc.exists && workspaceDoc.data().ownerId === userId) {
      return ROLES.WORKSPACE_ADMIN; // Workspace owner has admin role
    }
    
    // Check workspace membership
    const memberSnapshot = await db.collection('workspaceMembers')
      .where('workspaceId', '==', workspaceId)
      .where('userId', '==', userId)
      .get();
    
    if (!memberSnapshot.empty) {
      const role = memberSnapshot.docs[0].data().role || ROLES.MEMBER;
      // Normalize to lowercase for case-insensitive comparison
      return role ? role.toLowerCase() : ROLES.MEMBER;
    }
    
    return null; // User is not a member
  } catch (error) {
    console.error('Error getting user workspace role:', error);
    return null;
  }
};

// Get user's system role
const getUserSystemRole = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const role = userDoc.data().role || ROLES.MEMBER;
      // Normalize to lowercase for case-insensitive comparison
      return role ? role.toLowerCase() : ROLES.MEMBER;
    }
    return ROLES.MEMBER; // Default role
  } catch (error) {
    console.error('Error getting user system role:', error);
    return ROLES.MEMBER;
  }
};

// Check if role has permission
const hasPermission = (role, permission) => {
  // Normalize role to lowercase for case-insensitive comparison
  const normalizedRole = role ? role.toLowerCase() : '';
  const rolePermissions = ROLE_PERMISSIONS[normalizedRole] || [];
  return rolePermissions.includes(permission);
};

// Get role hierarchy level (higher number = more permissions)
const getRoleLevel = (role) => {
  // Normalize role to lowercase for case-insensitive comparison
  const normalizedRole = role ? role.toLowerCase() : '';
  const hierarchy = {
    [ROLES.VIEWER]: 1,
    [ROLES.MEMBER]: 2,
    [ROLES.MANAGER]: 3,
    [ROLES.WORKSPACE_ADMIN]: 4,
    [ROLES.ORG_ADMIN]: 5,
    [ROLES.ORG_OWNER]: 6,
    [ROLES.SUPER_ADMIN]: 7
  };
  return hierarchy[normalizedRole] || 0;
};

// Check if user can assign a specific role (can only assign roles at or below their level)
const canAssignRole = (userRole, targetRole) => {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);
  return userLevel > targetLevel; // Must be higher level to assign roles
};

// Check if two users are in the same organization
const areInSameOrganization = async (userId1, userId2) => {
  try {
    const org1 = await getUserOrganizationId(userId1);
    const org2 = await getUserOrganizationId(userId2);
    return org1 && org2 && org1 === org2;
  } catch (error) {
    console.error('Error checking organization membership:', error);
    return false;
  }
};

// Get all users in the same organization
const getOrganizationUsers = async (userId) => {
  try {
    const organizationId = await getUserOrganizationId(userId);
    if (!organizationId) return [];
    
    const usersSnapshot = await db.collection('users')
      .where('organizationId', '==', organizationId)
      .get();
    
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting organization users:', error);
    return [];
  }
};

// Check if user can manage another user (same org + sufficient role)
const canManageUser = async (adminUserId, targetUserId) => {
  try {
    // Check if users are in same organization
    const sameOrg = await areInSameOrganization(adminUserId, targetUserId);
    if (!sameOrg) return false;
    
    // Get roles
    const adminRole = await getUserOrganizationRole(adminUserId);
    const targetRole = await getUserOrganizationRole(targetUserId);
    
    // Admin must have higher role level
    return getRoleLevel(adminRole) > getRoleLevel(targetRole);
  } catch (error) {
    console.error('Error checking user management permission:', error);
    return false;
  }
};

// Middleware to check organization-level permissions
const requireOrganizationPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        console.log('⛔ Organization permission denied: No user authenticated');
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userRole = await getUserOrganizationRole(req.user.uid);
      const organizationId = await getUserOrganizationId(req.user.uid);
      
      console.log(`Checking organization permission for user ${req.user.uid}: role=${userRole}, org=${organizationId}, required=${permission}`);
      
      if (!organizationId) {
        console.log(`Organization permission denied for ${req.user.uid}: No organization membership`);
        return res.status(403).json({ error: 'Access denied: No organization membership' });
      }
      
      if (!hasPermission(userRole, permission)) {
        console.log(`Organization permission denied for ${req.user.uid}: Insufficient permissions (has: ${userRole}, needs: ${permission})`);
        return res.status(403).json({ 
          error: 'Access denied: Insufficient organization permissions',
          required: permission,
          userRole: userRole
        });
      }
      
      req.userRole = userRole;
      req.organizationId = organizationId;
      next();
    } catch (error) {
      console.error('Organization permission check error:', error);
      res.status(500).json({ error: 'Permission verification failed' });
    }
  };
};

// Middleware to check system-level permissions (for super admin only)
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userRole = await getUserSystemRole(req.user.uid);
      
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({ 
          error: 'Access denied: Insufficient permissions',
          required: permission,
          userRole: userRole
        });
      }
      
      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission verification failed' });
    }
  };
};

// Middleware to check workspace-specific permissions
const requireWorkspacePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const workspaceId = req.params.id || req.params.workspaceId || req.body.workspaceId;
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID required' });
      }
      
      const userRole = await getUserWorkspaceRole(req.user.uid, workspaceId);
      
      if (!userRole) {
        return res.status(403).json({ error: 'Access denied: Not a workspace member' });
      }
      
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({ 
          error: 'Access denied: Insufficient workspace permissions',
          required: permission,
          userRole: userRole,
          workspaceId: workspaceId
        });
      }
      
      req.workspaceRole = userRole;
      req.workspaceId = workspaceId;
      next();
    } catch (error) {
      console.error('Workspace permission check error:', error);
      res.status(500).json({ error: 'Workspace permission verification failed' });
    }
  };
};

// Check if user owns the resource or has sufficient role
const requireOwnershipOrRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // If checking task ownership
      if (req.params.id && req.baseUrl.includes('/tasks')) {
        const taskDoc = await db.collection('tasks').doc(req.params.id).get();
        if (taskDoc.exists && (taskDoc.data().userId === req.user.uid || taskDoc.data().assignedTo === req.user.uid)) {
          return next(); // User owns or is assigned the task
        }
      }
      
      // If checking file ownership
      if (req.params.id && req.baseUrl.includes('/files')) {
        const fileDoc = await db.collection('files').doc(req.params.id).get();
        if (fileDoc.exists && fileDoc.data().uploadedBy === req.user.uid) {
          return next(); // User owns the file
        }
      }
      
      // Check role as fallback
      const userRole = await getUserSystemRole(req.user.uid);
      const roleHierarchy = [ROLES.VIEWER, ROLES.MEMBER, ROLES.MANAGER, ROLES.WORKSPACE_ADMIN, ROLES.ORG_ADMIN, ROLES.ORG_OWNER, ROLES.SUPER_ADMIN];
      const userRoleIndex = roleHierarchy.indexOf(userRole);
      const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
      
      if (userRoleIndex >= requiredRoleIndex) {
        req.userRole = userRole;
        return next();
      }
      
      return res.status(403).json({ 
        error: 'Access denied: Insufficient role or not resource owner',
        required: requiredRole,
        userRole: userRole
      });
    } catch (error) {
      console.error('Ownership/role check error:', error);
      res.status(500).json({ error: 'Permission verification failed' });
    }
  };
};

module.exports = {
  ROLES,
  PERMISSIONS,
  requirePermission,
  requireOrganizationPermission,
  requireWorkspacePermission,
  requireOwnershipOrRole,
  getUserWorkspaceRole,
  getUserSystemRole,
  getUserOrganizationId,
  getUserOrganizationRole,
  hasPermission,
  getRoleLevel,
  canAssignRole,
  areInSameOrganization,
  getOrganizationUsers,
  canManageUser
};