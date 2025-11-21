// src/contexts/AuthContext.js - Authentication context for CloudCollab
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, organizationAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [needsOrganization, setNeedsOrganization] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const result = await authAPI.verifyToken();
          if (result.success && result.user) {
            const userWithOrg = await checkOrganizationStatus(result.user);
            setUser(userWithOrg);
          }
        }
      } catch (error) {
        console.error('AuthContext: Token verification failed:', error);
        authAPI.logout();
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  const checkOrganizationStatus = async (userData) => {
    try {
      const orgResult = await organizationAPI.getCurrent();
      setOrganization(orgResult.organization);
      setNeedsOrganization(false);
      return { ...userData, organizationRole: orgResult.userRole };
    } catch (error) {
      if (error.response?.status === 404) {
        // User not associated with any organization
        setNeedsOrganization(true);
        return userData;
      }
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      console.log('AuthContext: Attempting login with:', email);
      const result = await authAPI.login(email, password);
      console.log('AuthContext: Login result:', result);
      
      // Check if login was successful
      if (result.success && result.user) {
        const userWithOrg = await checkOrganizationStatus(result.user);
        setUser(userWithOrg);
        return result;
      } else {
        // Login failed, throw error with specific message
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      console.log('AuthContext: Attempting registration with:', userData);
      const result = await authAPI.register(userData);
      console.log('AuthContext: Registration result:', result);
      
      // Check if registration was successful
      if (result.success && result.user) {
        console.log('AuthContext: Setting user after registration:', result.user);
        // New users always need to create an organization
        setUser(result.user);
        setNeedsOrganization(true);
        return result;
      } else {
        // Registration failed, throw error with specific message
        throw new Error(result.error || 'Registration failed');
      }
    } catch (error) {
      console.error('AuthContext: Registration error:', error);
      throw error;
    }
  };

  const completeOrganizationSetup = (organizationData, userRole) => {
    if (organizationData) {
      setOrganization(organizationData);
      setNeedsOrganization(false);
      // Update user with organization role
      // For new orgs, userRole is undefined so default to org_owner
      // For invitations, userRole is passed from the invitation
      const role = userRole || organizationData.role || 'ORG_OWNER';
      setUser(prev => ({
        ...prev,
        organizationId: organizationData.id,
        organizationRole: role
      }));
    } else {
      // If no organization data provided, just mark as not needing organization
      setNeedsOrganization(false);
    }
  };

  const logout = () => {
    console.log('AuthContext: Logging out user');
    authAPI.logout();
    setUser(null);
    setOrganization(null);
    setNeedsOrganization(false);
  };

  const value = {
    user,
    organization,
    needsOrganization,
    login,
    register,
    logout,
    loading,
    completeOrganizationSetup
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;