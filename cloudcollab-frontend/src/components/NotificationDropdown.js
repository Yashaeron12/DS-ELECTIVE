// src/components/NotificationDropdown.js - Notification dropdown component
import React, { useState } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Typography,
  Box,
  Button,
  Divider,
  Chip,
  Avatar,
  CircularProgress,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MoreVert as MoreVertIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  MarkEmailRead as MarkAllReadIcon,
  Settings as SettingsIcon,
  FileUpload as FileIcon,
  Assignment as TaskIcon,
  Group as WorkspaceIcon,
  Security as SecurityIcon,
  Announcement as AnnouncementIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import NotificationSettings from './NotificationSettings';

const NotificationDropdown = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  const [anchorEl, setAnchorEl] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isOpen = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setMenuAnchorEl(null);
    setSelectedNotification(null);
  };

  const handleMenuClick = (event, notification) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedNotification(notification);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedNotification(null);
  };

  const handleMarkAsRead = async (notificationId, event) => {
    if (event) {
      event.stopPropagation();
    }
    await markAsRead(notificationId);
  };

  const handleDelete = async () => {
    if (selectedNotification) {
      await deleteNotification(selectedNotification.id);
      handleMenuClose();
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const getNotificationIcon = (type) => {
    const iconProps = { fontSize: 'small' };
    
    switch (type) {
      case 'file_uploaded':
      case 'file_shared':
      case 'file_deleted':
        return <FileIcon {...iconProps} />;
      case 'task_assigned':
      case 'task_completed':
      case 'task_due_soon':
      case 'task_overdue':
        return <TaskIcon {...iconProps} />;
      case 'workspace_invite':
      case 'member_joined':
      case 'member_left':
        return <WorkspaceIcon {...iconProps} />;
      case 'role_changed':
      case 'security_alert':
        return <SecurityIcon {...iconProps} />;
      case 'system_announcement':
        return <AnnouncementIcon {...iconProps} />;
      default:
        return <NotificationsIcon {...iconProps} />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        color="inherit"
        aria-label="notifications"
        sx={{ mr: 1 }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 600,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" component="h2">
              Notifications
            </Typography>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {unreadCount > 0 && (
              <Button
                size="small"
                startIcon={<MarkAllReadIcon />}
                onClick={handleMarkAllRead}
                variant="outlined"
              >
                Mark all read
              </Button>
            )}
          </Box>
        </Box>

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                You'll see notifications here when something happens
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{
                      backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'action.selected'
                      }
                    }}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                  >
                    <ListItemIcon>
                      <Avatar sx={{ 
                        width: 32, 
                        height: 32, 
                        bgcolor: notification.isRead ? 'grey.300' : 'primary.main' 
                      }}>
                        {getNotificationIcon(notification.type)}
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: notification.isRead ? 'normal' : 'bold',
                              flex: 1
                            }}
                          >
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.priority}
                            size="small"
                            color={getPriorityColor(notification.priority)}
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatNotificationTime(notification.createdAt)}
                          </Typography>
                        </>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {!notification.isRead && (
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => handleMarkAsRead(notification.id, e)}
                            title="Mark as read"
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        )}
                        
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => handleMenuClick(e, notification)}
                          title="More options"
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Button
              fullWidth
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => {
                setSettingsOpen(true);
                handleClose();
              }}
            >
              Notification Settings
            </Button>
          </Box>
        )}
      </Popover>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {selectedNotification && !selectedNotification.isRead && (
          <MenuItem onClick={() => {
            handleMarkAsRead(selectedNotification.id);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <CheckIcon fontSize="small" />
            </ListItemIcon>
            Mark as read
          </MenuItem>
        )}
        
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Notification Settings Dialog */}
      <NotificationSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
};

export default NotificationDropdown;