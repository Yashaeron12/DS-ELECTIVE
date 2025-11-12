// components/WorkspaceInvitations.js - Component to handle pending workspace invitations
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Business,
  Person
} from '@mui/icons-material';
import { workspaceAPI } from '../services/api';

const WorkspaceInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingInvitation, setProcessingInvitation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, invitation: null, action: '' });

  // Fetch pending invitations
  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const data = await workspaceAPI.getPendingInvitations();
      setInvitations(data);
      setError('');
    } catch (error) {
      console.error('Error fetching invitations:', error);
      setError('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    try {
      setProcessingInvitation(invitationId);
      setError('');
      setSuccess('');

      let result;
      if (action === 'accept') {
        result = await workspaceAPI.acceptInvitation(invitationId);
        setSuccess('Invitation accepted! You are now a member of the workspace.');
      } else {
        result = await workspaceAPI.declineInvitation(invitationId);
        setSuccess('Invitation declined.');
      }

      if (result.error) {
        setError(result.error);
      } else {
        // Remove the processed invitation from the list
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      }
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      setError(`Failed to ${action} invitation`);
    } finally {
      setProcessingInvitation(null);
      setConfirmDialog({ open: false, invitation: null, action: '' });
    }
  };

  const openConfirmDialog = (invitation, action) => {
    setConfirmDialog({ open: true, invitation, action });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, invitation: null, action: '' });
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      case 'member': return 'primary';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  const getRoleLabel = (role) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Business />
        Workspace Invitations
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        You have {invitations.length} pending workspace invitation{invitations.length !== 1 ? 's' : ''}
      </Typography>

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

      {invitations.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Business sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No pending invitations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When someone invites you to join their workspace, you'll see it here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {invitations.map((invitation) => (
            <Card key={invitation.id} elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Business />
                  </Avatar>
                  
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6">
                        {invitation.workspaceName}
                      </Typography>
                      <Chip 
                        label={getRoleLabel(invitation.role)} 
                        color={getRoleColor(invitation.role)}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <Person sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                      Invited by: {invitation.inviterEmail}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Sent: {new Date(invitation.createdAt).toLocaleDateString()}
                    </Typography>
                    
                    <Typography variant="body1" sx={{ mb: 3 }}>
                      You've been invited to join "<strong>{invitation.workspaceName}</strong>" 
                      as a <strong>{getRoleLabel(invitation.role)}</strong>.
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => openConfirmDialog(invitation, 'decline')}
                    disabled={processingInvitation === invitation.id}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => openConfirmDialog(invitation, 'accept')}
                    disabled={processingInvitation === invitation.id}
                  >
                    {processingInvitation === invitation.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      'Accept'
                    )}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog}>
        <DialogTitle>
          {confirmDialog.action === 'accept' ? 'Accept Invitation' : 'Decline Invitation'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmDialog.action} the invitation to join "
            <strong>{confirmDialog.invitation?.workspaceName}</strong>"?
            {confirmDialog.action === 'accept' && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
                <Typography variant="body2">
                  You will be added as a <strong>{getRoleLabel(confirmDialog.invitation?.role)}</strong> 
                  and will have access to workspace files, tasks, and team collaboration features.
                </Typography>
              </Box>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog}>
            Cancel
          </Button>
          <Button
            onClick={() => handleInvitationResponse(confirmDialog.invitation?.id, confirmDialog.action)}
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

export default WorkspaceInvitations;