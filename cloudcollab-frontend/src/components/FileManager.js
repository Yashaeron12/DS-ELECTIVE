import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Image,
  VideoFile,
  PictureAsPdf,
  Description,
  Archive,
  Download,
  Share,
  Delete
} from '@mui/icons-material';
import { fileAPI } from '../services/api';

const FileManager = () => {
  // Get user info
  const userEmail = localStorage.getItem('userEmail');
  const isNewUser = userEmail !== 'demo@cloudcollab.com';

  // Storage stats state
  const [storageStats, setStorageStats] = useState({
    usedGB: 0,
    limitGB: 10,
    usagePercentage: 0,
    fileCount: 0,
    availableGB: 10
  });
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Fetch storage stats
  useEffect(() => {
    const fetchStorageStats = async () => {
      try {
        setLoadingStorage(true);
        const response = await fileAPI.getStorageStats();
        if (response.success) {
          setStorageStats(response.storage);
        }
      } catch (error) {
        console.error('Error fetching storage stats:', error);
      } finally {
        setLoadingStorage(false);
      }
    };

    fetchStorageStats();
  }, []);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Helper functions
  const getFileTypeFromMime = (mimeType) => {
    if (!mimeType) return 'document';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    return 'document';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Fetch files from backend
  const fetchFiles = useCallback(async () => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('No auth token found, user may not be logged in');
      setFiles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const filesData = await fileAPI.getFiles();
      
      // Check if filesData is an array
      if (Array.isArray(filesData)) {
        const formattedFiles = filesData.map(file => ({
          id: file.id,
          name: file.fileName,
          type: getFileTypeFromMime(file.mimeType),
          size: formatFileSize(file.fileSize),
          uploadedBy: 'You',
          uploadDate: new Date(file.uploadedAt).toLocaleDateString(),
          shared: file.isPublic,
          downloadUrl: file.downloadUrl,
          mimeType: file.mimeType,
          description: file.description
        }));
        setFiles(formattedFiles);
      } else {
        // If no files or unexpected response, set empty array
        setFiles([]);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      
      // Always set empty array for errors (no demo data fallback)
      setFiles([]);
      
      // Only show demo data for the actual demo user
      if (userEmail === 'demo@cloudcollab.com') {
        setFiles([
          {
            id: 'demo1',
            name: 'README.md',
            type: 'document',
            size: '2 KB',
            uploadedBy: 'You',
            uploadDate: '2024-11-05',
            shared: false
          },
          {
            id: 'demo2',
            name: 'notes.txt',
            type: 'document',
            size: '512 B',
            uploadedBy: 'You',
            uploadDate: '2024-11-05',
            shared: false
          }
        ]);
      }
      
      // Optional: Show a subtle notification about connection issues
      // Don't show intrusive error messages, just silently handle it
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <PictureAsPdf sx={{ fontSize: 40, color: '#d32f2f' }} />;
      case 'image':
        return <Image sx={{ fontSize: 40, color: '#2e7d32' }} />;
      case 'video':
        return <VideoFile sx={{ fontSize: 40, color: '#1976d2' }} />;
      case 'document':
        return <Description sx={{ fontSize: 40, color: '#1976d2' }} />;
      case 'design':
        return <InsertDriveFile sx={{ fontSize: 40, color: '#9c27b0' }} />;
      case 'archive':
        return <Archive sx={{ fontSize: 40, color: '#ff9800' }} />;
      default:
        return <InsertDriveFile sx={{ fontSize: 40, color: '#757575' }} />;
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 30;
        });
      }, 500);
      
      await fileAPI.uploadFile(selectedFile, null, uploadDescription);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Close dialog and reset form
      setOpenUploadDialog(false);
      setSelectedFile(null);
      setUploadDescription('');
      setUploadProgress(0);
      
      // Refresh files list
      await fetchFiles();
      
      // Refresh storage stats
      const statsResponse = await fileAPI.getStorageStats();
      if (statsResponse.success) {
        setStorageStats(statsResponse.storage);
      }
      
      alert('File uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setSelectedFile(droppedFiles[0]);
      setOpenUploadDialog(true);
    }
  };

  // Action handlers
  const handleDownload = async (file) => {
    try {
      console.log('🔽 Download clicked for file:', file);
      
      let downloadUrl;
      
      if (file.downloadUrl) {
        // Use the pre-generated download URL from the database
        downloadUrl = file.downloadUrl;
        console.log('📎 Using stored download URL:', downloadUrl);
      } else {
        // This shouldn't happen if files are properly stored, but fallback
        console.warn('⚠️ No downloadUrl found, using file ID fallback');
        downloadUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/files/download/${file.id}`;
      }
      
      // Test the URL first to see if it's accessible
      console.log('🧪 Testing download URL:', downloadUrl);
      
      try {
        // Try a HEAD request first to check if the file exists
        const response = await fetch(downloadUrl, { 
          method: 'HEAD',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`File not found (${response.status}): ${response.statusText}`);
        }
        
        console.log('✅ File exists, proceeding with download');
        
        // Create proper download link
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.name || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSnackbar(`Downloading "${file.name}"...`, 'success');
        
      } catch (fetchError) {
        console.error('❌ Download URL test failed:', fetchError);
        showSnackbar(`Failed to download "${file.name}": ${fetchError.message}`, 'error');
      }
      
    } catch (error) {
      console.error('Download error:', error);
      showSnackbar('Failed to download file: ' + error.message, 'error');
    }
  };

  const handleShare = async (file) => {
    try {
      console.log('🔗 Share clicked for file:', file);
      
      let shareUrl;
      
      if (file.downloadUrl) {
        shareUrl = file.downloadUrl;
        console.log('📎 Using stored download URL for sharing:', shareUrl);
      } else {
        console.warn('⚠️ No downloadUrl found for sharing, using file ID fallback');
        shareUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/files/download/${file.id}`;
      }
      
      // Copy download link to clipboard for sharing
      try {
        await navigator.clipboard.writeText(shareUrl);
        showSnackbar(`Share link copied to clipboard for "${file.name}"`, 'success');
        console.log(`✅ Share link copied: ${shareUrl}`);
      } catch (clipboardError) {
        console.log('📋 Clipboard API failed, using fallback method');
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showSnackbar(`Share link copied to clipboard for "${file.name}"`, 'success');
        console.log(`✅ Share link copied (fallback): ${shareUrl}`);
      }
      
    } catch (error) {
      console.error('Share error:', error);
      showSnackbar('Failed to copy share link: ' + error.message, 'error');
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return;
    }
    
    try {
      const response = await fileAPI.deleteFile(file.id);
      if (response.message) {
        // Refresh files list
        await fetchFiles();
        
        // Refresh storage stats
        const statsResponse = await fileAPI.getStorageStats();
        if (statsResponse.success) {
          setStorageStats(statsResponse.storage);
        }
        
        alert('File deleted successfully!');
      } else {
        alert('Failed to delete file: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file');
    }
  };

  const getRecentActivity = () => {
    if (isNewUser) {
      return []; // New users have no activity yet
    } else {
      return [
        { action: 'uploaded', file: 'README.md', user: 'You', time: '2 hours ago' },
        { action: 'uploaded', file: 'notes.txt', user: 'You', time: '4 hours ago' }
      ];
    }
  };

  const recentActivity = getRecentActivity();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          File Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<CloudUpload />}
          onClick={() => setOpenUploadDialog(true)}
          sx={{
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            borderRadius: 2,
            px: 3
          }}
        >
          Upload File
        </Button>
      </Box>

      {/* Upload Progress */}
      {uploading && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Uploading file... {uploadProgress}%
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={uploadProgress}
            sx={{ 
              height: 8,
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)'
              }
            }}
          />
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* File Grid */}
        <Grid item xs={12} lg={8}>
          {loading ? (
            <Card sx={{ 
              p: 8, 
              textAlign: 'center', 
              borderRadius: 3,
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
            }}>
              <CircularProgress 
                size={60} 
                sx={{ 
                  color: '#1976d2',
                  mb: 3
                }} 
              />
              <Typography variant="h6" sx={{ 
                fontWeight: 500, 
                color: '#1976d2',
                mb: 1
              }}>
                Loading your files...
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Please wait while we fetch your documents
              </Typography>
            </Card>
          ) : files.length === 0 ? (
            <Card sx={{ 
              p: 6, 
              textAlign: 'center', 
              borderRadius: 3,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              border: '2px dashed #e0e0e0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{ 
                position: 'relative',
                zIndex: 2
              }}>
                <CloudUpload sx={{ 
                  fontSize: 80, 
                  color: '#1976d2', 
                  mb: 3,
                  filter: 'drop-shadow(0 4px 8px rgba(25, 118, 210, 0.2))'
                }} />
                <Typography variant="h5" sx={{ 
                  fontWeight: 600, 
                  color: '#1976d2',
                  mb: 2
                }}>
                  Ready to get started?
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                  Your file management workspace is empty. Upload your first file to begin organizing and sharing your documents.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={() => setOpenUploadDialog(true)}
                  size="large"
                  sx={{
                    background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                    '&:hover': {
                      boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Upload Your First File
                </Button>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                  Drag & drop files or click to browse • Up to 10MB per file
                </Typography>
              </Box>
              
              {/* Decorative elements */}
              <Box sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(25, 118, 210, 0.1)',
                zIndex: 1
              }} />
              <Box sx={{
                position: 'absolute',
                bottom: -30,
                left: -30,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(66, 165, 245, 0.1)',
                zIndex: 1
              }} />
            </Card>
          ) : (
            <Grid container spacing={2}>
              {files.map((file) => (
              <Grid item xs={12} sm={6} md={4} key={file.id}>
                <Card sx={{ 
                  borderRadius: 3,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                  }
                }}>
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Box sx={{ mb: 2 }}>
                      {getFileIcon(file.type)}
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {file.name}
                    </Typography>
                    
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      {file.size}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      {file.shared && (
                        <Chip 
                          label="Shared" 
                          size="small" 
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                      by {file.uploadedBy} • {file.uploadDate}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleDownload(file)}
                        title="Download"
                      >
                        <Download />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="primary"
                        onClick={() => handleShare(file)}
                        title="Share"
                      >
                        <Share />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDelete(file)}
                        title="Delete"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            </Grid>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Storage Stats */}
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Your Storage Usage
              </Typography>
              {loadingStorage ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <Typography variant="body2" color="textSecondary">Loading...</Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Your Files</Typography>
                    <Typography variant="body2">
                      {storageStats.usedGB.toFixed(2)} GB / {storageStats.limitGB} GB
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(storageStats.usagePercentage, 100)}
                    sx={{ 
                      height: 8,
                      borderRadius: 4,
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: storageStats.usagePercentage > 80 
                          ? 'linear-gradient(45deg, #d32f2f 30%, #f44336 90%)'
                          : storageStats.usagePercentage > 60
                          ? 'linear-gradient(45deg, #ff9800 30%, #ffb74d 90%)'
                          : 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)'
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      {storageStats.fileCount} files
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {storageStats.availableGB.toFixed(2)} GB available
                    </Typography>
                  </Box>
                </Box>
              )}
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>File Types</Typography>
                {[
                  { type: 'Documents', count: isNewUser ? 0 : 24, color: '#1976d2' },
                  { type: 'Images', count: isNewUser ? 0 : 18, color: '#2e7d32' },
                  { type: 'Videos', count: isNewUser ? 0 : 6, color: '#d32f2f' },
                  { type: 'Others', count: isNewUser ? 0 : 12, color: '#ff9800' }
                ].map((item) => (
                  <Box key={item.type} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        backgroundColor: item.color, 
                        mr: 1 
                      }} />
                      <Typography variant="body2">{item.type}</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {item.count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Activity
              </Typography>
              <List sx={{ mt: 1 }}>
                {recentActivity.map((activity, index) => (
                  <ListItem key={index} sx={{ px: 0, py: 1 }}>
                    <ListItemIcon>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                        {activity.user[0]}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          <strong>{activity.user}</strong> {activity.action}{' '}
                          <span style={{ color: '#1976d2' }}>{activity.file}</span>
                        </Typography>
                      }
                      secondary={activity.time}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upload Dialog */}
      <Dialog open={openUploadDialog} onClose={() => setOpenUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Upload File</DialogTitle>
        <DialogContent>
          <input
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="file-upload-input"
            accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          <label htmlFor="file-upload-input">
            <Box 
              sx={{ 
                border: `2px dashed ${dragOver ? '#1976d2' : '#ccc'}`,
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                mt: 2,
                cursor: 'pointer',
                backgroundColor: dragOver ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#1976d2',
                  backgroundColor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <CloudUpload sx={{ fontSize: 48, color: '#1976d2', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                {selectedFile ? selectedFile.name : 'Click to select or drag & drop a file'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Support for images, documents, videos and more
              </Typography>
              {selectedFile && (
                <Typography variant="body2" sx={{ mt: 1, color: '#1976d2' }}>
                  Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </Typography>
              )}
            </Box>
          </label>
          <TextField
            fullWidth
            label="File Description (Optional)"
            multiline
            rows={2}
            margin="normal"
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
          />
          {uploading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Uploading... Please wait
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenUploadDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleFileUpload}
            variant="contained"
            disabled={!selectedFile || uploading}
            sx={{
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
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
    </Box>
  );
};

export default FileManager;