import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Badge,
  AvatarGroup,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  PersonAdd,
  Group,
  AdminPanelSettings,
  Work,
  Circle,
  Refresh
} from '@mui/icons-material';
import { workspaceAPI } from '../services/api';

const TeamManager = () => {
  // State management
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog states
  const [openWorkspaceDialog, setOpenWorkspaceDialog] = useState(false);
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '', isPrivate: true });
  const [newInvite, setNewInvite] = useState({ userEmail: '', role: 'member' });

  // Load workspaces and members
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      setError('');
      const workspacesData = await workspaceAPI.getWorkspaces();
      setWorkspaces(workspacesData);

      // Fetch members for each workspace
      const membersData = {};
      for (const workspace of workspacesData) {
        try {
          const members = await workspaceAPI.getMembers(workspace.id);
          membersData[workspace.id] = members;
        } catch (memberError) {
          console.warn(`Could not fetch members for workspace ${workspace.id}:`, memberError);
          membersData[workspace.id] = [];
        }
      }
      setWorkspaceMembers(membersData);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      setError('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    if (role.toLowerCase().includes('lead') || 
        role.toLowerCase().includes('manager') || 
        role.toLowerCase().includes('admin')) {
      return <AdminPanelSettings sx={{ color: '#1976d2' }} />;
    }
    return <Work sx={{ color: '#757575' }} />;
  };

  const handleCreateWorkspace = async () => {
    if (newWorkspace.name && newWorkspace.description) {
      try {
        setError('');
        await workspaceAPI.createWorkspace(newWorkspace);
        setSuccess('Workspace created successfully!');
        setNewWorkspace({ name: '', description: '', isPrivate: true });
        setOpenWorkspaceDialog(false);
        // Refresh workspaces list
        fetchWorkspaces();
      } catch (error) {
        console.error('Error creating workspace:', error);
        setError('Failed to create workspace');
      }
    }
  };

  const handleInviteMember = async () => {
    if (newInvite.userEmail && newInvite.role && selectedWorkspace) {
      try {
        setError('');
        await workspaceAPI.inviteUser(selectedWorkspace.id, newInvite.userEmail, newInvite.role);
        setSuccess(`Invitation sent to ${newInvite.userEmail}!`);
        setNewInvite({ userEmail: '', role: 'member' });
        setOpenInviteDialog(false);
        setSelectedWorkspace(null);
        // Refresh workspace members
        fetchWorkspaces();
      } catch (error) {
        console.error('Error sending invitation:', error);
        setError('Failed to send invitation');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Team Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchWorkspaces}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenWorkspaceDialog(true)}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              borderRadius: 2,
              px: 3
            }}
          >
            Create Workspace
          </Button>
        </Box>
      </Box>

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

      {/* Workspace Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 2 }}>
            <CardContent>
              <Group sx={{ fontSize: 48, color: '#1976d2', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2' }}>
                {workspaces.length}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Active Workspaces
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 2 }}>
            <CardContent>
              <PersonAdd sx={{ fontSize: 48, color: '#2e7d32', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                {Object.values(workspaceMembers).reduce((total, members) => total + members.length, 0)}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Total Members
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 2 }}>
            <CardContent>
              <Circle sx={{ fontSize: 48, color: '#2e7d32', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                {workspaces.filter(ws => ws.role === 'owner' || ws.role === 'admin').length}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                You Manage
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Group sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No workspaces found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first workspace to start collaborating with your team.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenWorkspaceDialog(true)}
              sx={{
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              }}
            >
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {workspaces.map((workspace) => {
            const members = workspaceMembers[workspace.id] || [];
            return (
              <Grid item xs={12} lg={6} key={workspace.id}>
                <Card sx={{ 
                  borderRadius: 3,
                  height: '100%',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                  }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {workspace.name}
                          </Typography>
                          <Badge
                            badgeContent={workspace.role}
                            color={workspace.role === 'owner' ? 'error' : 'primary'}
                            sx={{ 
                              '& .MuiBadge-badge': { 
                                fontSize: '0.7rem',
                                minWidth: 'auto',
                                padding: '0 6px'
                              }
                            }}
                          />
                        </Box>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          {workspace.description || 'No description provided'}
                        </Typography>
                      </Box>
                      <IconButton 
                        size="small"
                        onClick={() => {
                          setSelectedWorkspace(workspace);
                          setOpenInviteDialog(true);
                        }}
                        disabled={workspace.role === 'viewer'}
                      >
                        <PersonAdd />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      <AvatarGroup max={4} sx={{ mr: 2 }}>
                        {members.slice(0, 4).map((member, index) => (
                          <Avatar 
                            key={member.userId || index}
                            sx={{ width: 32, height: 32 }}
                          >
                            {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                      <Typography variant="body2" color="textSecondary">
                        {members.length} member{members.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>

                    <List sx={{ p: 0 }}>
                      {members.slice(0, 3).map((member, index) => (
                        <ListItem key={member.userId || index} sx={{ px: 0, py: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ width: 40, height: 40 }}>
                              {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {member.displayName || member.email}
                                </Typography>
                                {getRoleIcon(member.role)}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="caption" color="textSecondary">
                                  {member.role}
                                </Typography>
                                <br />
                                <Typography variant="caption" color="textSecondary">
                                  {member.email}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      {members.length > 3 && (
                        <Typography variant="caption" color="textSecondary" sx={{ pl: 2 }}>
                          +{members.length - 3} more member{members.length - 3 !== 1 ? 's' : ''}
                        </Typography>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={openWorkspaceDialog} onClose={() => setOpenWorkspaceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Workspace</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Workspace Name"
            value={newWorkspace.name}
            onChange={(e) => setNewWorkspace({...newWorkspace, name: e.target.value})}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Workspace Description"
            multiline
            rows={3}
            value={newWorkspace.description}
            onChange={(e) => setNewWorkspace({...newWorkspace, description: e.target.value})}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Privacy</InputLabel>
            <Select
              value={newWorkspace.isPrivate}
              onChange={(e) => setNewWorkspace({...newWorkspace, isPrivate: e.target.value})}
              label="Privacy"
            >
              <MenuItem value={true}>Private (Invite only)</MenuItem>
              <MenuItem value={false}>Public (Anyone can join)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenWorkspaceDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateWorkspace}
            variant="contained"
            disabled={!newWorkspace.name}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            }}
          >
            Create Workspace
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={openInviteDialog} onClose={() => setOpenInviteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Invite Member to {selectedWorkspace?.name}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={newInvite.userEmail}
            onChange={(e) => setNewInvite({...newInvite, userEmail: e.target.value})}
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={newInvite.role}
              onChange={(e) => setNewInvite({...newInvite, role: e.target.value})}
              label="Role"
            >
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenInviteDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleInviteMember}
            variant="contained"
            disabled={!newInvite.userEmail}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            }}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamManager;