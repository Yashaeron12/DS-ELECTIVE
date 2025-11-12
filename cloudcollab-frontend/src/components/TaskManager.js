import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Paper,
  IconButton,
  Menu,
  MenuItem as MenuItemComponent,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  CheckCircle,
  Schedule,
  CalendarToday,
  Assignment as AssignmentIcon,
  DoneAll as DoneAllIcon,
  AttachFile as AttachFileIcon,
  CloudUpload as UploadIcon,
  Description as FileIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
  AssignmentInd as AssignmentIndIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { taskAPI, fileAPI, workspaceAPI } from '../services/api';

const TaskManager = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Helper function to format file sizes
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 bytes';
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };
  const [openDialog, setOpenDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    category: 'general',
    workspaceId: '',
    assignedTo: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [fileUploadDialog, setFileUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentsPopover, setAttachmentsPopover] = useState({ open: false, anchorEl: null, taskId: null });
  const [taskFiles, setTaskFiles] = useState([]);
  
  // Workspace and assignment states
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState({});
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignTask, setAssignTask] = useState({ workspaceId: '', assignedTo: '' });

  // Load tasks on component mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        const tasksData = await taskAPI.getTasks();
        console.log('📋 TaskManager loaded tasks:', tasksData.length);
        console.log('📎 Tasks with attachments:', tasksData.filter(t => t.attachmentCount > 0).length);
        tasksData.forEach(task => {
          if (task.attachmentCount > 0) {
            console.log(`📎 Task "${task.title}": ${task.attachmentCount} attachments`);
          }
        });
        setTasks(tasksData);
      } catch (error) {
        showSnackbar('Failed to load tasks', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadTasks();
    loadWorkspacesAndMembers(); // Load workspaces for assignment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Load workspaces and members for task assignment
  const loadWorkspacesAndMembers = async () => {
    try {
      setLoadingWorkspaces(true);
      const workspacesData = await workspaceAPI.getWorkspaces();
      setWorkspaces(workspacesData);

      // Load members for each workspace
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
      console.error('Error loading workspaces:', error);
      showSnackbar('Failed to load workspaces', 'error');
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const handleShowAttachments = async (event, task) => {
    event.stopPropagation();
    setAttachmentsPopover({ 
      open: true, 
      anchorEl: event.currentTarget, 
      taskId: task.id 
    });
    
    try {
      // Fetch files for this task using the proper API service
      const result = await fileAPI.getTaskFiles(task.id);
      setTaskFiles(result.files || []);
    } catch (error) {
      console.error('Error loading task files:', error);
      setTaskFiles([]);
      showSnackbar('Failed to load task files', 'error');
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsPopover({ open: false, anchorEl: null, taskId: null });
    setTaskFiles([]);
  };

  const handleDownloadFile = (file) => {
    // Download file using the proper download endpoint
    if (file.downloadUrl) {
      // Create a proper download that forces download instead of opening in browser
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.fileName || file.originalName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSnackbar(`Downloading "${file.fileName || file.originalName}"...`);
    } else {
      showSnackbar('Download URL not available', 'error');
    }
  };

  const handleShareFile = async (file) => {
    try {
      // Copy download link to clipboard for sharing
      await navigator.clipboard.writeText(file.downloadUrl);
      showSnackbar(`Share link copied to clipboard for "${file.fileName || file.originalName}"`);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = file.downloadUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showSnackbar(`Share link copied to clipboard for "${file.fileName || file.originalName}"`);
    }
  };

  const handleAddTask = async () => {
    if (newTask.title && newTask.description) {
      try {
        const createdTask = await taskAPI.createTask(newTask);
        setTasks(prev => [createdTask, ...prev]);
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          dueDate: '',
          category: 'general',
          workspaceId: '',
          assignedTo: ''
        });
        setOpenDialog(false);
        showSnackbar(
          newTask.assignedTo ? 
          `Task created and assigned successfully` : 
          'Task created successfully'
        );
      } catch (error) {
        showSnackbar('Failed to create task', 'error');
      }
    }
  };

  const handleMenuClick = (event, task) => {
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const updateTaskStatus = async (taskId, completed) => {
    try {
      await taskAPI.updateTask(taskId, { completed });
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, completed } : task
      ));
      showSnackbar(`Task marked as ${completed ? 'completed' : 'incomplete'}`);
    } catch (error) {
      showSnackbar('Failed to update task', 'error');
    }
    handleMenuClose();
  };

  const deleteTask = async (taskId) => {
    try {
      await taskAPI.deleteTask(taskId);
      setTasks(tasks.filter(task => task.id !== taskId));
      showSnackbar('Task deleted successfully');
    } catch (error) {
      showSnackbar('Failed to delete task', 'error');
    }
    handleMenuClose();
  };

  const handleFileUpload = (task) => {
    // Close menu first
    setAnchorEl(null);
    // Then set the task and open dialog
    setSelectedTask(task);
    setFileUploadDialog(true);
  };

  const handleAssignTask = (task) => {
    // Close menu first
    setAnchorEl(null);
    // Set current task data
    setSelectedTask(task);
    setAssignTask({
      workspaceId: task.workspaceId || '',
      assignedTo: task.assignedTo || ''
    });
    setAssignDialog(true);
  };

  const submitTaskAssignment = async () => {
    if (!selectedTask) return;

    try {
      const updateData = {
        workspaceId: assignTask.workspaceId || null,
        assignedTo: assignTask.assignedTo || null
      };

      await taskAPI.updateTask(selectedTask.id, updateData);
      
      // Update local task state
      setTasks(tasks.map(task => 
        task.id === selectedTask.id 
          ? { ...task, ...updateData }
          : task
      ));

      setAssignDialog(false);
      setAssignTask({ workspaceId: '', assignedTo: '' });
      
      if (assignTask.assignedTo) {
        const assigneeName = getAssigneeName({ ...selectedTask, ...updateData });
        showSnackbar(`Task assigned to ${assigneeName}`, 'success');
      } else {
        showSnackbar('Task assignment updated', 'success');
      }
    } catch (error) {
      console.error('Error updating task assignment:', error);
      showSnackbar('Failed to update task assignment', 'error');
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const uploadFileToTask = async () => {
    if (!selectedFile || !selectedTask) return;

    try {
      setUploadingFile(true);
      
      // Upload file with taskId for automatic linking
      const response = await fileAPI.uploadFile(
        selectedFile, 
        null, 
        `Attached to task: ${selectedTask.title}`, 
        selectedTask.id
      );
      
      if (response.success !== false) {
        // Update task in state with new attachment count
        setTasks(tasks.map(task => 
          task.id === selectedTask.id 
            ? { ...task, attachmentCount: (task.attachmentCount || 0) + 1 }
            : task
        ));
        
        showSnackbar(`File "${selectedFile.name}" uploaded and attached to task`);
        setFileUploadDialog(false);
        setSelectedFile(null);
      } else {
        showSnackbar(response.error || 'Failed to upload file', 'error');
      }
    } catch (error) {
      showSnackbar('Failed to upload file', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#d32f2f';
      case 'medium': return '#1976d2';
      case 'low': return '#2e7d32';
      default: return '#757575';
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'design': return '#9c27b0';
      case 'development': return '#1976d2';
      case 'documentation': return '#2e7d32';
      case 'testing': return '#ff9800';
      case 'bug': return '#d32f2f';
      default: return '#757575';
    }
  };

  // Get assignee display name
  const getAssigneeName = (task) => {
    if (!task.assignedTo || !task.workspaceId) return null;
    const members = workspaceMembers[task.workspaceId] || [];
    const assignee = members.find(m => m.userId === task.assignedTo);
    return assignee ? (assignee.displayName || assignee.email) : 'Unknown User';
  };

  // Get workspace name
  const getWorkspaceName = (task) => {
    if (!task.workspaceId) return null;
    const workspace = workspaces.find(w => w.id === task.workspaceId);
    return workspace ? workspace.name : 'Unknown Workspace';
  };

  // Organize tasks by status
  const todoTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);
  
  // Debug logging for attachment rendering
  console.log('🔍 TaskManager render - Todo tasks:', todoTasks.length);
  const todoWithAttachments = todoTasks.filter(t => t.attachmentCount > 0);
  console.log('📎 Todo tasks with attachments for rendering:', todoWithAttachments.length);
  todoWithAttachments.forEach(task => {
    console.log(`📎 Rendering attachment for: "${task.title}" (${task.attachmentCount} files)`);
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Task Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            borderRadius: 2,
            px: 3
          }}
        >
          New Task
        </Button>
      </Box>

      {/* Kanban Board */}
      <Grid container spacing={3}>
        {/* Todo Column */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 2, 
            borderRadius: 3,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            minHeight: todoTasks.length > 0 ? 'auto' : '300px',
            height: 'fit-content'
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 2,
              pb: 1,
              borderBottom: '2px solid',
              borderColor: '#757575'
            }}>
              <Schedule />
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                Todo
              </Typography>
              <Chip 
                label={todoTasks.length} 
                size="small" 
                sx={{ 
                  ml: 'auto',
                  backgroundColor: '#757575',
                  color: 'white'
                }}
              />
            </Box>

            {todoTasks.length === 0 ? (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                textAlign: 'center'
              }}>
                <AssignmentIcon sx={{ 
                  fontSize: 64, 
                  color: 'text.secondary',
                  opacity: 0.5,
                  mb: 2 
                }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No tasks in progress
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create a new task to get started
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenDialog(true)}
                  sx={{ borderRadius: 2 }}
                >
                  Add First Task
                </Button>
              </Box>
            ) : (
              todoTasks.map((task) => (
                <Card key={task.id} sx={{ 
                  mb: 2, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }
                }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                        {task.title}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleMenuClick(e, task)}
                      >
                        <MoreIcon />
                      </IconButton>
                    </Box>

                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {task.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        label={task.priority} 
                        size="small"
                        sx={{
                          backgroundColor: getPriorityColor(task.priority),
                          color: 'white',
                          fontWeight: 500
                        }}
                      />
                      <Chip 
                        label={task.category} 
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: getCategoryColor(task.category),
                          color: getCategoryColor(task.category)
                        }}
                      />
                      
                      {/* Workspace Chip */}
                      {getWorkspaceName(task) && (
                        <Chip 
                          icon={<BusinessIcon sx={{ fontSize: '0.8rem' }} />}
                          label={getWorkspaceName(task)} 
                          size="small"
                          sx={{
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            borderColor: '#1976d2'
                          }}
                        />
                      )}
                      
                      {/* Assignment Chip */}
                      {getAssigneeName(task) && (
                        <Chip 
                          icon={<AssignmentIndIcon sx={{ fontSize: '0.8rem' }} />}
                          label={getAssigneeName(task)} 
                          size="small"
                          sx={{
                            backgroundColor: '#f3e5f5',
                            color: '#9c27b0',
                            borderColor: '#9c27b0'
                          }}
                        />
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {task.dueDate && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="caption" color="textSecondary">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </Typography>
                          </Box>
                        )}
                        {task.attachmentCount > 0 && (
                          <Tooltip title="Click to view attached files" arrow>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5,
                                backgroundColor: 'primary.main',
                                color: 'white',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'primary.dark',
                                  transform: 'scale(1.05)'
                                },
                                transition: 'all 0.2s ease'
                              }}
                              onClick={(e) => handleShowAttachments(e, task)}
                            >
                              <AttachFileIcon sx={{ fontSize: 14, color: 'white' }} />
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                                {task.attachmentCount} file{task.attachmentCount !== 1 ? 's' : ''}
                              </Typography>
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Paper>
        </Grid>

        {/* Completed Column */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 2, 
            borderRadius: 3,
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            minHeight: completedTasks.length > 0 ? 'auto' : '300px',
            height: 'fit-content'
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 2,
              pb: 1,
              borderBottom: '2px solid',
              borderColor: '#2e7d32'
            }}>
              <CheckCircle />
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                Completed
              </Typography>
              <Chip 
                label={completedTasks.length} 
                size="small" 
                sx={{ 
                  ml: 'auto',
                  backgroundColor: '#2e7d32',
                  color: 'white'
                }}
              />
            </Box>

            {completedTasks.length === 0 ? (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                textAlign: 'center'
              }}>
                <DoneAllIcon sx={{ 
                  fontSize: 64, 
                  color: 'text.secondary',
                  opacity: 0.5,
                  mb: 2 
                }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No completed tasks yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed tasks will appear here
                </Typography>
              </Box>
            ) : (
              completedTasks.map((task) => (
                <Card key={task.id} sx={{ 
                  mb: 2, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s ease-in-out',
                  opacity: 0.8,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    opacity: 1,
                  }
                }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', textDecoration: 'line-through' }}>
                        {task.title}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleMenuClick(e, task)}
                      >
                        <MoreIcon />
                      </IconButton>
                    </Box>

                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {task.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        label={task.priority} 
                        size="small"
                        sx={{
                          backgroundColor: getPriorityColor(task.priority),
                          color: 'white',
                          fontWeight: 500
                        }}
                      />
                      <Chip 
                        label={task.category} 
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: getCategoryColor(task.category),
                          color: getCategoryColor(task.category)
                        }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {task.dueDate && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="caption" color="textSecondary">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItemComponent onClick={() => handleFileUpload(selectedTask)}>
          <AttachFileIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
          Attach File
        </MenuItemComponent>
        <MenuItemComponent onClick={() => handleAssignTask(selectedTask)}>
          <AssignmentIndIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
          Assign Task
        </MenuItemComponent>
        <MenuItemComponent onClick={() => updateTaskStatus(selectedTask?.id, false)}>
          Mark as Todo
        </MenuItemComponent>
        <MenuItemComponent onClick={() => updateTaskStatus(selectedTask?.id, true)}>
          Mark as Completed
        </MenuItemComponent>
        <MenuItemComponent onClick={() => deleteTask(selectedTask?.id)} sx={{ color: 'error.main' }}>
          Delete Task
        </MenuItemComponent>
      </Menu>

      {/* File Upload Dialog */}
      <Dialog open={fileUploadDialog} onClose={() => setFileUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Attach File to Task: {selectedTask?.title}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              accept="*"
              style={{ display: 'none' }}
              id="file-upload-input"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                sx={{
                  width: '100%',
                  height: '100px',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: selectedFile ? 'primary.main' : 'grey.400',
                  backgroundColor: selectedFile ? 'primary.50' : 'grey.50',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.50',
                  }
                }}
              >
                {selectedFile ? selectedFile.name : 'Click to select file or drag and drop'}
              </Button>
            </label>
            {selectedFile && (
              <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  <strong>File:</strong> {selectedFile.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Type:</strong> {selectedFile.type || 'Unknown'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => {
            setFileUploadDialog(false);
            setSelectedFile(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={uploadFileToTask}
            disabled={!selectedFile || uploadingFile}
            variant="contained"
            startIcon={uploadingFile ? <CircularProgress size={20} /> : <AttachFileIcon />}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            }}
          >
            {uploadingFile ? 'Uploading...' : 'Attach File'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Task</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Task Title"
            value={newTask.title}
            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={newTask.description}
            onChange={(e) => setNewTask({...newTask, description: e.target.value})}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select
              value={newTask.priority}
              label="Priority"
              onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={newTask.category}
              label="Category"
              onChange={(e) => setNewTask({...newTask, category: e.target.value})}
            >
              <MenuItem value="general">General</MenuItem>
              <MenuItem value="development">Development</MenuItem>
              <MenuItem value="design">Design</MenuItem>
              <MenuItem value="documentation">Documentation</MenuItem>
              <MenuItem value="testing">Testing</MenuItem>
              <MenuItem value="bug">Bug Fix</MenuItem>
            </Select>
          </FormControl>
          
          {/* Workspace Assignment Section */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Workspace (Optional)</InputLabel>
            <Select
              value={newTask.workspaceId}
              label="Workspace (Optional)"
              onChange={(e) => {
                setNewTask({...newTask, workspaceId: e.target.value, assignedTo: ''});
              }}
              disabled={loadingWorkspaces}
            >
              <MenuItem value="">
                <em>Personal Task (No Workspace)</em>
              </MenuItem>
              {workspaces.map((workspace) => (
                <MenuItem key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.memberCount} members)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {newTask.workspaceId && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Assign To</InputLabel>
              <Select
                value={newTask.assignedTo}
                label="Assign To"
                onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {(workspaceMembers[newTask.workspaceId] || []).map((member) => (
                  <MenuItem key={member.userId} value={member.userId}>
                    {member.displayName || member.email} ({member.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Due Date"
            type="date"
            value={newTask.dueDate}
            onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
            InputLabelProps={{
              shrink: true,
            }}
            margin="normal"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddTask}
            variant="contained"
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            }}
          >
            Create Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* File Attachments Popover */}
      <Popover
        open={attachmentsPopover.open}
        anchorEl={attachmentsPopover.anchorEl}
        onClose={handleCloseAttachments}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            maxWidth: 300,
            minWidth: 200,
            maxHeight: 400,
            overflow: 'auto'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachFileIcon fontSize="small" />
            Attached Files
          </Typography>
          
          {taskFiles.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No files attached
            </Typography>
          ) : (
            <List dense>
              {taskFiles.map((file, index) => (
                <ListItem 
                  key={file.id || index}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    },
                    display: 'flex',
                    alignItems: 'flex-start'
                  }}
                >
                  <ListItemIcon>
                    <FileIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.fileName || file.originalName || 'Unknown file'}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          Size: {file.fileSize || file.size ? 
                            formatFileSize(file.fileSize || file.size) : 
                            'Unknown'}
                        </Typography>
                        {file.description && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {file.description}
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ pr: 1 }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Tooltip title="Download file" arrow>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDownloadFile(file)}
                        sx={{
                          color: 'primary.main',
                          '&:hover': {
                            backgroundColor: 'primary.50',
                            color: 'primary.dark'
                          }
                        }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy share link" arrow>
                      <IconButton 
                        size="small" 
                        onClick={() => handleShareFile(file)}
                        sx={{
                          color: 'success.main',
                          '&:hover': {
                            backgroundColor: 'success.50',
                            color: 'success.dark'
                          }
                        }}
                      >
                        <ShareIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Popover>

      {/* Task Assignment Dialog */}
      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Assign Task: {selectedTask?.title}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Workspace</InputLabel>
            <Select
              value={assignTask.workspaceId}
              label="Workspace"
              onChange={(e) => {
                setAssignTask({...assignTask, workspaceId: e.target.value, assignedTo: ''});
              }}
              disabled={loadingWorkspaces}
            >
              <MenuItem value="">
                <em>Personal Task (No Workspace)</em>
              </MenuItem>
              {workspaces.map((workspace) => (
                <MenuItem key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.memberCount} members)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {assignTask.workspaceId && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Assign To</InputLabel>
              <Select
                value={assignTask.assignedTo}
                label="Assign To"
                onChange={(e) => setAssignTask({...assignTask, assignedTo: e.target.value})}
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {(workspaceMembers[assignTask.workspaceId] || []).map((member) => (
                  <MenuItem key={member.userId} value={member.userId}>
                    {member.displayName || member.email} ({member.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button 
            onClick={submitTaskAssignment}
            variant="contained"
            startIcon={<AssignmentIndIcon />}
            sx={{
              background: 'linear-gradient(45deg, #9c27b0 30%, #e1bee7 90%)',
            }}
          >
            {assignTask.assignedTo ? 'Assign Task' : 'Update Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TaskManager;