// src/components/NotificationSettings.js - Notification preferences component
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Alert,
  TextField,
  Grid,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  VolumeOff as QuietIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationSettings = ({ open, onClose }) => {
  const { preferences, updatePreferences, sendTestNotification } = useNotifications();
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Notification type descriptions
  const notificationTypes = {
    file_uploaded: 'File uploads to your workspaces',
    file_shared: 'Files shared with you',
    file_deleted: 'File deletions in your workspaces',
    task_assigned: 'Tasks assigned to you',
    task_completed: 'Task completion updates',
    task_due_soon: 'Task due date reminders',
    task_overdue: 'Overdue task alerts',
    workspace_invite: 'Workspace invitations',
    member_joined: 'New members joining workspaces',
    member_left: 'Members leaving workspaces',
    role_changed: 'Role and permission changes',
    security_alert: 'Security-related notifications',
    system_announcement: 'System announcements and updates'
  };

  const priorityDescriptions = {
    urgent: 'Critical notifications (immediate + sound)',
    high: 'Important notifications (immediate)',
    medium: 'Normal notifications',
    low: 'Low priority (can be batched)'
  };

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleSave = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const success = await updatePreferences(localPreferences);
      if (success) {
        setMessage({ type: 'success', text: 'Notification preferences saved successfully!' });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while saving preferences.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      setMessage({ type: 'success', text: 'Test notification sent!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to send test notification.' });
    }
  };

  const handleGlobalToggle = (enabled) => {
    setLocalPreferences(prev => ({
      ...prev,
      enabled
    }));
  };

  const handleTypeToggle = (type, enabled) => {
    setLocalPreferences(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: enabled
      }
    }));
  };

  const handleDeliveryMethodToggle = (method, enabled) => {
    setLocalPreferences(prev => ({
      ...prev,
      [method]: enabled
    }));
  };

  const handleQuietHoursToggle = (enabled) => {
    setLocalPreferences(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        enabled
      }
    }));
  };

  const handleQuietHoursTimeChange = (field, value) => {
    setLocalPreferences(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [field]: value
      }
    }));
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon />
          Notification Settings
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 3 }}>
          {message.text && (
            <Alert 
              severity={message.type} 
              sx={{ mb: 2 }}
              onClose={() => setMessage({ type: '', text: '' })}
            >
              {message.text}
            </Alert>
          )}

          {/* Global Settings */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              General Settings
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={localPreferences.enabled}
                    onChange={(e) => handleGlobalToggle(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable notifications"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localPreferences.pushNotifications}
                    onChange={(e) => handleDeliveryMethodToggle('pushNotifications', e.target.checked)}
                    disabled={!localPreferences.enabled}
                    color="primary"
                  />
                }
                label="Browser push notifications"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localPreferences.emailNotifications}
                    onChange={(e) => handleDeliveryMethodToggle('emailNotifications', e.target.checked)}
                    disabled={!localPreferences.enabled}
                    color="primary"
                  />
                }
                label="Email notifications"
              />
            </FormGroup>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestNotification}
                disabled={!localPreferences.enabled}
              >
                Send Test Notification
              </Button>
            </Box>
          </Paper>

          {/* Quiet Hours */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <QuietIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Quiet Hours
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={localPreferences.quietHours?.enabled || false}
                  onChange={(e) => handleQuietHoursToggle(e.target.checked)}
                  disabled={!localPreferences.enabled}
                  color="primary"
                />
              }
              label="Enable quiet hours (no notifications during these times)"
            />

            {localPreferences.quietHours?.enabled && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Start Time"
                    type="time"
                    value={localPreferences.quietHours.start}
                    onChange={(e) => handleQuietHoursTimeChange('start', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="End Time"
                    type="time"
                    value={localPreferences.quietHours.end}
                    onChange={(e) => handleQuietHoursTimeChange('end', e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            )}
          </Paper>

          {/* Notification Types */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Notification Types
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose which types of notifications you want to receive
            </Typography>

            <List dense>
              {Object.entries(notificationTypes).map(([type, description]) => (
                <ListItem key={type} divider>
                  <ListItemText
                    primary={description}
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {type.replace(/_/g, ' ')}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={localPreferences.types?.[type] || false}
                      onChange={(e) => handleTypeToggle(type, e.target.checked)}
                      disabled={!localPreferences.enabled}
                      color="primary"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Priority Information */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Priority Levels
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Understanding notification priorities
            </Typography>

            {Object.entries(priorityDescriptions).map(([priority, description]) => (
              <Box key={priority} sx={{ mb: 1 }}>
                <Chip
                  label={priority.toUpperCase()}
                  size="small"
                  color={
                    priority === 'urgent' ? 'error' :
                    priority === 'high' ? 'warning' :
                    priority === 'medium' ? 'info' : 'default'
                  }
                  sx={{ mr: 1, minWidth: 80 }}
                />
                <Typography variant="body2" component="span">
                  {description}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationSettings;