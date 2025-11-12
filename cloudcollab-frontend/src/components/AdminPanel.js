import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Edit,
  Block,
  CheckCircle,
  AdminPanelSettings,
  PersonAdd
} from '@mui/icons-material';
import { adminAPI, organizationAPI } from '../services/api';

const AdminPanel = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Invitation states
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchUsers();
    fetchAvailableRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getUsers();
      setUsers(response.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. You may not have admin permissions.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const response = await adminAPI.getAvailableRoles();
      setAvailableRoles(response.availableRoles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleEditRole = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setReason('');
    setError('');
    setSuccess('');
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      setUpdating(true);
      setError('');

      await adminAPI.updateUserRole(selectedUser.id, newRole, reason);
      
      setSuccess(`Successfully updated ${selectedUser.displayName || selectedUser.email} to ${newRole}`);
      setEditDialogOpen(false);
      
      // Refresh users list
      await fetchUsers();
      
      // Clear form
      setSelectedUser(null);
      setNewRole('');
      setReason('');
    } catch (error) {
      console.error('Error updating role:', error);
      setError(error.response?.data?.error || 'Failed to update user role');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusToggle = async (user) => {
    try {
      const newStatus = !user.isActive;
      await adminAPI.updateUserStatus(user.id, newStatus, 
        newStatus ? 'Reactivated by admin' : 'Deactivated by admin'
      );
      
      setSuccess(`Successfully ${newStatus ? 'activated' : 'deactivated'} ${user.displayName || user.email}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      setError(error.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleOpenInviteDialog = () => {
    setInviteEmail('');
    setInviteRole('MEMBER');
    setError('');
    setSuccess('');
    setInviteDialogOpen(true);
  };

  const handleInviteMember = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setInviting(true);
      setError('');

      await organizationAPI.inviteMember(inviteEmail, inviteRole);
      
      setSuccess(`Successfully sent invitation to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
    } catch (error) {
      console.error('Error inviting member:', error);
      setError(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'super_admin': 'error',
      'admin': 'warning', 
      'manager': 'info',
      'member': 'primary',
      'viewer': 'default'
    };
    return colors[role] || 'default';
  };

  const getRoleDisplayName = (role) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AdminPanelSettings sx={{ color: '#1976d2' }} />
          Team Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={handleOpenInviteDialog}
          sx={{ 
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            fontWeight: 600
          }}
        >
          Invite Member
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Users Table */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Joined</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                          {user.displayName || 'No Name'}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getRoleDisplayName(user.role)}
                        color={getRoleColor(user.role)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                        icon={user.isActive ? <CheckCircle /> : <Block />}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Edit Role">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleEditRole(user)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={user.isActive ? 'Deactivate' : 'Activate'}>
                          <IconButton 
                            size="small" 
                            color={user.isActive ? 'error' : 'success'}
                            onClick={() => handleStatusToggle(user)}
                          >
                            {user.isActive ? <Block /> : <CheckCircle />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Role Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Update User Role
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Updating role for: <strong>{selectedUser.displayName || selectedUser.email}</strong>
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>New Role</InputLabel>
                <Select
                  value={newRole}
                  label="New Role"
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {availableRoles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getRoleDisplayName(role.value)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {role.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Reason for Change"
                multiline
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you're changing this user's role..."
                helperText="This will be logged for audit purposes"
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateRole}
            variant="contained"
            disabled={!newRole || updating}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            }}
          >
            {updating ? <CircularProgress size={20} /> : 'Update Role'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAdd color="primary" />
          Invite New Team Member
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Send an invitation to join your organization. They will receive an invitation 
              that they can accept when they sign up or log in.
            </Typography>
            
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              sx={{ mb: 3 }}
              autoFocus
              helperText="Enter the email address of the person you want to invite"
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={inviteRole}
                label="Role"
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <MenuItem value="MEMBER">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Member
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Can participate in workspaces and create content
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="MANAGER">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Manager
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Can manage tasks and files within workspaces
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="WORKSPACE_ADMIN">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Workspace Admin
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Can manage specific workspaces and their members
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="ORG_ADMIN">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Organization Admin
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Can manage organization workspaces and members
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setInviteDialogOpen(false)} disabled={inviting}>
            Cancel
          </Button>
          <Button 
            onClick={handleInviteMember}
            variant="contained"
            disabled={!inviteEmail || inviting}
            startIcon={inviting ? <CircularProgress size={16} /> : <PersonAdd />}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              fontWeight: 600
            }}
          >
            {inviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPanel;