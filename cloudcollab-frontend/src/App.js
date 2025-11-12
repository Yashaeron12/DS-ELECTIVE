import React, { useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Switch,
  Paper,
  Avatar,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment as TaskIcon,
  Folder as FileIcon,
  Group as TeamIcon,
  Settings as SettingsIcon,
  Brightness4,
  Brightness7,
  Logout as LogoutIcon,
  Person as PersonIcon,
  AccountCircle,
  Palette,
  Security,
  AdminPanelSettings,
  Business as BusinessIcon
} from '@mui/icons-material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import AuthWrapper from './components/AuthWrapper';
import Dashboard from './components/Dashboard';
import TaskManager from './components/TaskManager';
import FileManager from './components/FileManager';
import TeamManager from './components/TeamManager';
import AdminPanel from './components/AdminPanel';
import OrganizationOnboarding from './components/OrganizationOnboarding';
import WorkspaceInvitations from './components/WorkspaceInvitations';
import NotificationDropdown from './components/NotificationDropdown';

const drawerWidth = 240;

function MainApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const { user, logout, needsOrganization, completeOrganizationSetup } = useAuth();
  
  // Check if user has admin privileges (organization-scoped)
  const isAdmin = () => {
    // Check if user has organization admin privileges
    return user?.organizationRole === 'org_owner' || 
           user?.organizationRole === 'org_admin' || 
           user?.role === 'admin' || // Legacy compatibility
           user?.role === 'manager'; // Legacy compatibility
  };
  
  // User profile menu states
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [userSettings, setUserSettings] = useState({
    displayName: user?.displayName || '',
    theme: 'light',
    notifications: true,
    emailUpdates: true,
    language: 'English'
  });
  const open = Boolean(anchorEl);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#dc004e',
      },
      background: {
        default: darkMode ? '#121212' : '#f5f5f5',
        paper: darkMode ? '#1e1e1e' : '#ffffff',
      },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 500,
      },
    },
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
  };

  // User profile menu handlers
  const handleUserMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileDialogOpen = () => {
    setProfileDialogOpen(true);
    handleUserMenuClose();
  };

  const handleProfileDialogClose = () => {
    setProfileDialogOpen(false);
  };

  const handleSettingsChange = (field, value) => {
    setUserSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = () => {
    // Here you would typically save to backend
    console.log('Saving profile settings:', userSettings);
    handleProfileDialogClose();
  };

  // Menu items with conditional admin panel
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, view: 'dashboard' },
    { text: 'Tasks', icon: <TaskIcon />, view: 'tasks' },
    { text: 'Files', icon: <FileIcon />, view: 'files' },
    { text: 'Teams', icon: <TeamIcon />, view: 'teams' },
    { text: 'Invitations', icon: <BusinessIcon />, view: 'invitations' },
    ...(isAdmin() ? [{ text: 'Admin Panel', icon: <AdminPanelSettings />, view: 'admin' }] : []),
    { text: 'Settings', icon: <SettingsIcon />, view: 'settings' },
  ];

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ 
          background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          CloudCollab
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem 
            button 
            key={item.text}
            onClick={() => setCurrentView(item.view)}
            sx={{
              margin: '4px 8px',
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
              ...(currentView === item.view && {
                backgroundColor: theme.palette.primary.main + '20',
                borderLeft: `4px solid ${theme.palette.primary.main}`,
              }),
            }}
          >
            <ListItemIcon sx={{ color: currentView === item.view ? theme.palette.primary.main : 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return <TaskManager />;
      case 'files':
        return <FileManager />;
      case 'teams':
        return <TeamManager />;
      case 'invitations':
        return <WorkspaceInvitations />;
      case 'admin':
        return isAdmin() ? <AdminPanel /> : (
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>Access Denied</Typography>
            <Typography>You don't have admin privileges to access this page.</Typography>
          </Paper>
        );
      case 'settings':
        return (
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>Settings</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Brightness7 />
              <Switch checked={darkMode} onChange={handleThemeToggle} />
              <Brightness4 />
              <Typography sx={{ ml: 1 }}>
                {darkMode ? 'Dark' : 'Light'} Mode
              </Typography>
            </Box>
          </Paper>
        );
      default:
        return <Dashboard />;
    }
  };

  // Show organization onboarding if user needs to create one
  if (needsOrganization) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <OrganizationOnboarding 
          user={user} 
          onComplete={completeOrganizationSetup}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            boxShadow: '0 4px 20px 0 rgba(0,0,0,0.1)',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              {menuItems.find(item => item.view === currentView)?.text || 'Dashboard'}
            </Typography>
            
            {/* Notification Dropdown */}
            <NotificationDropdown />
            
            {/* User Profile Menu */}
            <Tooltip title={`User ID: ${user?.uid || 'Not available'}`}>
              <IconButton
                onClick={handleUserMenuClick}
                sx={{ ml: 1 }}
                aria-controls={open ? 'user-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
              >
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36 }}>
                  {user?.email?.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
            
            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleUserMenuClose}
              MenuListProps={{
                'aria-labelledby': 'user-button',
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem disabled>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {user?.displayName || user?.email}
                </Typography>
              </MenuItem>
              <MenuItem disabled>
                <Typography variant="caption" color="textSecondary">
                  ID: {user?.uid?.substring(0, 8)}...
                </Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleProfileDialogOpen}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Profile Settings</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => setCurrentView('settings')}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>App Settings</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={logout} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
                </ListItemIcon>
                <ListItemText>Logout</ListItemText>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box
          component="nav"
          sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                borderRight: 'none',
                boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            minHeight: '100vh',
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Toolbar />
          {renderContent()}
        </Box>

        {/* Profile Settings Dialog */}
        <Dialog 
          open={profileDialogOpen} 
          onClose={handleProfileDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AccountCircle sx={{ mr: 1 }} />
              Profile Settings
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              {/* User Info Section */}
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <PersonIcon sx={{ mr: 1 }} /> User Information
              </Typography>
              <TextField
                fullWidth
                label="Display Name"
                value={userSettings.displayName}
                onChange={(e) => handleSettingsChange('displayName', e.target.value)}
                margin="normal"
                variant="outlined"
              />
              <TextField
                fullWidth
                label="Email Address"
                value={user?.email || ''}
                margin="normal"
                variant="outlined"
                disabled
                helperText="Email cannot be changed"
              />
              <TextField
                fullWidth
                label="User ID"
                value={user?.uid || 'Not available'}
                margin="normal"
                variant="outlined"
                disabled
                helperText="Your unique identifier"
              />

              <Divider sx={{ my: 3 }} />

              {/* Preferences Section */}
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Palette sx={{ mr: 1 }} /> Preferences
              </Typography>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={userSettings.notifications}
                    onChange={(e) => handleSettingsChange('notifications', e.target.checked)}
                  />
                }
                label="Enable push notifications"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={userSettings.emailUpdates}
                    onChange={(e) => handleSettingsChange('emailUpdates', e.target.checked)}
                  />
                }
                label="Receive email updates"
              />

              <TextField
                select
                fullWidth
                label="Language"
                value={userSettings.language}
                onChange={(e) => handleSettingsChange('language', e.target.value)}
                margin="normal"
                SelectProps={{
                  native: true,
                }}
              >
                <option value="English">English</option>
                <option value="Spanish">Español</option>
                <option value="French">Français</option>
                <option value="German">Deutsch</option>
              </TextField>

              <Divider sx={{ my: 3 }} />

              {/* Security Section */}
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Security sx={{ mr: 1 }} /> Security
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Last login: {new Date().toLocaleDateString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Account created: {new Date().toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleProfileDialogClose}>Cancel</Button>
            <Button onClick={handleSaveProfile} variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h6">Loading...</Typography>
      </Box>
    );
  }

  if (!user) {
    return <AuthWrapper />;
  }

  return <MainApp />;
}

export default App;
