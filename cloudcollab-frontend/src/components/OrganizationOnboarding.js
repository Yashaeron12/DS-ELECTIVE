import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  CheckCircle as CheckIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { organizationAPI } from '../services/api';
import OrganizationInvitations from './OrganizationInvitations';

const OrganizationOnboarding = ({ user, onComplete }) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizationData, setOrganizationData] = useState({
    name: '',
    description: ''
  });
  const [tabValue, setTabValue] = useState(0);
  const [hasInvitations, setHasInvitations] = useState(false);
  const [checkingInvitations, setCheckingInvitations] = useState(true);

  const steps = [
    'Join or Create Organization',
    'Setup Complete'
  ];

  useEffect(() => {
    checkForInvitations();
  }, []);

  const checkForInvitations = async () => {
    try {
      setCheckingInvitations(true);
      const response = await organizationAPI.getInvitations();
      const invitations = response.invitations || [];
      setHasInvitations(invitations.length > 0);
      
      // If user has invitations, default to invitations tab
      if (invitations.length > 0) {
        setTabValue(0); // Invitations tab
      } else {
        setTabValue(1); // Create organization tab
      }
    } catch (error) {
      console.error('Error checking for invitations:', error);
      // If error checking invitations, default to create organization
      setTabValue(1);
    } finally {
      setCheckingInvitations(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!organizationData.name.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const result = await organizationAPI.create(
        organizationData.name.trim(),
        organizationData.description.trim()
      );
      
      console.log('Organization created:', result);
      setStep(1);
      
      // Complete onboarding after a short delay
      setTimeout(() => {
        onComplete(result.organization);
      }, 2000);
      
    } catch (error) {
      console.error('Error creating organization:', error);
      setError(error.response?.data?.error || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field) => (event) => {
    setOrganizationData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError(''); // Clear error when user types
  };

  const handleInvitationAccepted = (organizationData, userRole) => {
    // When invitation is accepted, complete onboarding with organization data and role
    onComplete(organizationData, userRole);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError(''); // Clear any errors when switching tabs
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      p: 2
    }}>
      <Card sx={{ 
        maxWidth: 600, 
        width: '100%',
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <BusinessIcon sx={{ fontSize: 48, color: '#1976d2', mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Welcome to CloudCollab!
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Let's set up your team workspace
            </Typography>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={step} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* User Info */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="primary" />
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  Signed in as:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {user?.displayName || user?.email || 'User'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {step === 0 && (
            <Box>
              {checkingInvitations ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={32} />
                  <Typography sx={{ mt: 2 }}>
                    Checking for invitations...
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Tab Navigation */}
                  <Tabs 
                    value={tabValue} 
                    onChange={handleTabChange} 
                    sx={{ mb: 3 }}
                    variant="fullWidth"
                  >
                    <Tab 
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmailIcon />
                          Invitations
                          {hasInvitations && (
                            <Box sx={{ 
                              backgroundColor: 'error.main', 
                              color: 'white', 
                              borderRadius: '50%', 
                              width: 20, 
                              height: 20, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              !
                            </Box>
                          )}
                        </Box>
                      } 
                      disabled={!hasInvitations}
                    />
                    <Tab 
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon />
                          Create New
                        </Box>
                      } 
                    />
                  </Tabs>

                  {/* Invitations Tab */}
                  {tabValue === 0 && hasInvitations && (
                    <Box>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        You have pending organization invitations! Accept one to join an existing team.
                      </Alert>
                      <OrganizationInvitations onInvitationAccepted={handleInvitationAccepted} />
                    </Box>
                  )}

                  {/* Create Organization Tab */}
                  {tabValue === 1 && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                        Create Your Organization
                      </Typography>
                      
                      <TextField
                        fullWidth
                        label="Organization Name"
                        value={organizationData.name}
                        onChange={handleInputChange('name')}
                        placeholder="e.g., Acme Corp, My Startup, Design Team"
                        sx={{ mb: 3 }}
                        required
                        disabled={loading}
                      />
                      
                      <TextField
                        fullWidth
                        label="Description (Optional)"
                        value={organizationData.description}
                        onChange={handleInputChange('description')}
                        placeholder="Brief description of your organization..."
                        multiline
                        rows={3}
                        sx={{ mb: 4 }}
                        disabled={loading}
                      />
                      
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleCreateOrganization}
                        disabled={loading || !organizationData.name.trim()}
                        sx={{
                          py: 1.5,
                          background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                          fontSize: '1.1rem',
                          fontWeight: 600
                        }}
                      >
                        {loading ? (
                          <>
                            <CircularProgress size={24} sx={{ mr: 2 }} />
                            Creating Organization...
                          </>
                        ) : (
                          'Create Organization'
                        )}
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}

          {step === 1 && (
            <Box sx={{ textAlign: 'center' }}>
              <CheckIcon sx={{ 
                fontSize: 64, 
                color: '#4caf50', 
                mb: 2,
                animation: 'pulse 2s infinite'
              }} />
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                Organization Created Successfully!
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
                Your workspace is ready. You are now the organization owner with full administrative privileges.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Redirecting to your dashboard...
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default OrganizationOnboarding;