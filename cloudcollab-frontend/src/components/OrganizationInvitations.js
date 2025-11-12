import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Avatar
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { organizationAPI } from '../services/api';

const OrganizationInvitations = ({ onInvitationAccepted }) => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    invitation: null,
    action: null
  });

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const response = await organizationAPI.getInvitations();
      console.log('Invitations response:', response);
      setInvitations(response.invitations || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      setError('Failed to load organization invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationAction = async (invitationId, action) => {
    try {
      setError('');
      setSuccess('');
      
      let result;
      if (action === 'accept') {
        result = await organizationAPI.acceptInvitation(invitationId);
        setSuccess('Invitation accepted! You are now a member of the organization.');
        
        // Notify parent component with organization data and role
        if (onInvitationAccepted) {
          onInvitationAccepted(result.organization, result.role);
        }
      } else if (action === 'decline') {
        result = await organizationAPI.declineInvitation(invitationId);
        setSuccess('Invitation declined.');
      }
      
      // Refresh invitations list
      await fetchInvitations();
      
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      setError(error.response?.data?.error || `Failed to ${action} invitation`);
    } finally {
      setConfirmDialog({ open: false, invitation: null, action: null });
    }
  };

  const openConfirmDialog = (invitation, action) => {
    setConfirmDialog({ open: true, invitation, action });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, invitation: null, action: null });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  const getRoleColor = (role) => {
    const roleColors = {
      'ORG_OWNER': 'error',
      'ORG_ADMIN': 'warning',
      'WORKSPACE_ADMIN': 'info',
      'MANAGER': 'primary',
      'MEMBER': 'success',
      'VIEWER': 'default'
    };
    return roleColors[role] || 'default';
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'ORG_OWNER': 'Organization Owner',
      'ORG_ADMIN': 'Organization Admin',
      'WORKSPACE_ADMIN': 'Workspace Admin',
      'MANAGER': 'Manager',
      'MEMBER': 'Member',
      'VIEWER': 'Viewer'
    };
    return roleNames[role] || role;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading invitations...</Typography>
      </Box>
    );
  }

  if (invitations.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No pending invitations
        </Typography>
        <Typography color="text.secondary">
          You don't have any pending organization invitations at this time.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Organization Invitations
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2}>
        {invitations.map((invitation) => (
          <Grid item xs={12} md={6} key={invitation.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="div">
                      {invitation.organization.name}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {invitation.organization.description || 'No description'}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Role Offered:
                  </Typography>
                  <Chip 
                    label={getRoleDisplayName(invitation.role)}
                    color={getRoleColor(invitation.role)}
                    size="small"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    <PersonIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Invited by:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invitation.invitedBy.displayName} ({invitation.invitedBy.email})
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    <TimeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Expires:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(invitation.expiresAt)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeclineIcon />}
                    onClick={() => openConfirmDialog(invitation, 'decline')}
                    size="small"
                  >
                    Decline
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<AcceptIcon />}
                    onClick={() => openConfirmDialog(invitation, 'accept')}
                    size="small"
                  >
                    Accept
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirmDialog.action === 'accept' ? 'Accept Invitation' : 'Decline Invitation'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmDialog.action} the invitation to join "
            {confirmDialog.invitation?.organization?.name}"?
            {confirmDialog.action === 'accept' && (
              <>
                <br /><br />
                <strong>You will be granted the role of:</strong> {getRoleDisplayName(confirmDialog.invitation?.role)}
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => handleInvitationAction(confirmDialog.invitation?.id, confirmDialog.action)}
            color={confirmDialog.action === 'accept' ? 'success' : 'error'}
            variant="contained"
          >
            {confirmDialog.action === 'accept' ? 'Accept' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationInvitations;