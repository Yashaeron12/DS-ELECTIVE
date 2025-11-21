import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  TrendingUp,
  Assignment,
  Group,
  CloudUpload,
  CheckCircle,
  Schedule,
  Warning
} from '@mui/icons-material';
import { taskAPI, fileAPI, workspaceAPI } from '../services/api';

const Dashboard = () => {
  // Get user info
  const displayName = localStorage.getItem('userDisplayName') || 'User';
  
  // State for real-time data
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    tasks: [],
    files: [],
    workspaces: [],
    stats: {
      activeTasks: 0,
      completedTasks: 0,
      totalFiles: 0,
      teamMembers: 1
    }
  });

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        const [tasksResponse, filesResponse, workspacesResponse] = await Promise.allSettled([
          taskAPI.getTasks(),
          fileAPI.getFiles(),
          workspaceAPI.getWorkspaces()
        ]);

        const tasks = tasksResponse.status === 'fulfilled' ? (Array.isArray(tasksResponse.value) ? tasksResponse.value : (tasksResponse.value.tasks || [])) : [];
        const files = filesResponse.status === 'fulfilled' ? (Array.isArray(filesResponse.value) ? filesResponse.value : (filesResponse.value.files || [])) : [];
        const workspaces = workspacesResponse.status === 'fulfilled' ? (Array.isArray(workspacesResponse.value) ? workspacesResponse.value : (workspacesResponse.value.workspaces || [])) : [];

        const activeTasks = tasks.filter(task => !task.completed).length;
        const completedTasks = tasks.filter(task => task.completed).length;
        const totalFiles = files.length;
        const completionPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

        setDashboardData({
          tasks: tasks.slice(0, 5),
          files,
          workspaces,
          stats: {
            activeTasks,
            completedTasks,
            totalFiles,
            teamMembers: 1,
            completionPercentage
          }
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    const refreshInterval = setInterval(fetchDashboardData, 5000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Generate dynamic stats from real data
  const stats = [
    {
      title: 'Active Tasks',
      value: dashboardData.stats.activeTasks.toString(),
      change: dashboardData.stats.activeTasks === 0 ? 'Create first task' : `${dashboardData.stats.activeTasks} in progress`,
      icon: <Assignment sx={{ fontSize: 40, color: '#1976d2' }} />,
      color: '#1976d2'
    },
    {
      title: 'Team Members',
      value: dashboardData.stats.teamMembers.toString(),
      change: 'Just you',
      icon: <Group sx={{ fontSize: 40, color: '#2e7d32' }} />,
      color: '#2e7d32'
    },
    {
      title: 'Files Uploaded',
      value: dashboardData.stats.totalFiles.toString(),
      change: dashboardData.stats.totalFiles === 0 ? 'Upload files' : `${dashboardData.stats.totalFiles} files`,
      icon: <CloudUpload sx={{ fontSize: 40, color: '#ed6c02' }} />,
      color: '#ed6c02'
    },
    {
      title: 'Completion',
      value: `${dashboardData.stats.completionPercentage || 0}%`,
      change: dashboardData.stats.completionPercentage > 0 ? `${dashboardData.stats.completedTasks} completed` : 'Start now',
      icon: <TrendingUp sx={{ fontSize: 40, color: '#9c27b0' }} />,
      color: '#9c27b0'
    }
  ];

  // Use real tasks data
  const recentTasks = dashboardData.tasks.map(task => ({
    id: task.id,
    title: task.title,
    status: task.completed ? 'Completed' : 'In Progress',
    assignee: 'You',
    priority: task.priority || 'Medium',
    dueDate: task.dueDate
  }));

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle sx={{ color: '#2e7d32' }} />;
      case 'In Progress':
        return <Schedule sx={{ color: '#1976d2' }} />;
      default:
        return <Warning sx={{ color: '#ed6c02' }} />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical':
        return 'error';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress size={60} sx={{ color: '#1976d2' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        Welcome back, {displayName}! 👋
      </Typography>
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ 
              height: '100%',
              background: `linear-gradient(135deg, ${stat.color}08 0%, ${stat.color}20 100%)`,
              border: `1px solid ${stat.color}30`,
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 8px 25px ${stat.color}30`,
              }
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 700, color: stat.color, mb: 1 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 1 }}>
                      {stat.title}
                    </Typography>
                    <Chip 
                      label={stat.change} 
                      size="small" 
                      sx={{ 
                        backgroundColor: `${stat.color}20`,
                        color: stat.color,
                        fontWeight: 600
                      }}
                    />
                  </Box>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    backgroundColor: `${stat.color}15` 
                  }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Project Progress */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Project Progress
              </Typography>
              <Box sx={{ mt: 3 }}>
                {dashboardData.tasks.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      No tasks yet. Create your first task to see progress here!
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" fontWeight={500}>Task Completion</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {dashboardData.stats.completionPercentage}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={dashboardData.stats.completionPercentage} 
                        sx={{ 
                          height: 8, 
                          borderRadius: 4,
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)'
                          }
                        }}
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        {dashboardData.stats.completedTasks} of {dashboardData.stats.activeTasks + dashboardData.stats.completedTasks} tasks completed
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Tasks */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Tasks
              </Typography>
              {recentTasks.length > 0 ? (
                <List sx={{ mt: 2 }}>
                  {recentTasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemAvatar>
                          {getStatusIcon(task.status)}
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={500}>
                              {task.title}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip 
                                label={task.priority} 
                                size="small" 
                                color={getPriorityColor(task.priority)}
                                variant="outlined"
                              />
                              <Typography variant="caption" color="textSecondary">
                                {task.assignee}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentTasks.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Assignment sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                  <Typography variant="body2" color="textSecondary">
                    No tasks yet. Create your first task to get started!
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Team Activity */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Team Activity
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 2 }}>
                <Box>
                  <Typography variant="body2" color="textSecondary">Active Members</Typography>
                  <AvatarGroup max={6} sx={{ mt: 1 }}>
                    {['A', 'B', 'C', 'D', 'E', 'F'].map((initial, index) => (
                      <Avatar 
                        key={index} 
                        sx={{ 
                          bgcolor: ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#1565c0'][index],
                          width: 40,
                          height: 40
                        }}
                      >
                        {initial}
                      </Avatar>
                    ))}
                  </AvatarGroup>
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" color="textSecondary">Recent Activity</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {dashboardData.tasks.length === 0 && dashboardData.stats.totalFiles === 0 ? (
                      <>
                        🎉 Welcome to CloudCollab, {displayName}!<br/>
                        📝 Create your first task<br/>
                        📁 Upload your first file
                      </>
                    ) : (
                      <>
                        📝 {dashboardData.stats.activeTasks} tasks in progress<br/>
                        📁 {dashboardData.stats.totalFiles} files uploaded<br/>
                        ✅ {dashboardData.stats.completedTasks} tasks completed
                      </>
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;