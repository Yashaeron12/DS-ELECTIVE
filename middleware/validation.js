const validator = require('validator');

const validateEmail = (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  req.body.email = validator.normalizeEmail(email);
  next();
};

const validatePassword = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  if (password.length > 128) {
    return res.status(400).json({ error: 'Password is too long' });
  }
  
  next();
};

const validateStringLength = (field, minLength = 1, maxLength = 1000) => {
  return (req, res, next) => {
    const value = req.body[field];
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: `${field} is required` });
    }
    
    const strValue = String(value).trim();
    
    if (strValue.length < minLength) {
      return res.status(400).json({ 
        error: `${field} must be at least ${minLength} character${minLength > 1 ? 's' : ''} long` 
      });
    }
    
    if (strValue.length > maxLength) {
      return res.status(400).json({ 
        error: `${field} must be no more than ${maxLength} characters long` 
      });
    }
    
    req.body[field] = strValue;
    next();
  };
};

const validateUUID = (paramName) => {
  return (req, res, next) => {
    const value = req.params[paramName] || req.body[paramName];
    
    if (!value) {
      return res.status(400).json({ error: `${paramName} is required` });
    }
    
    if (!validator.isUUID(value) && !isFirestoreId(value)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    
    next();
  };
};

const isFirestoreId = (str) => {
  return /^[a-zA-Z0-9]{20,}$/.test(str);
};

const sanitizeHtml = (field) => {
  return (req, res, next) => {
    if (req.body[field]) {
      req.body[field] = req.body[field]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    next();
  };
};

const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const maxSize = 10 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return res.status(400).json({ 
      error: 'File too large',
      details: `Maximum file size is ${maxSize / (1024 * 1024)}MB` 
    });
  }
  
  // Validate filename
  if (!req.file.originalname) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.app'];
  const extension = req.file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
  
  if (extension && dangerousExtensions.includes(extension)) {
    return res.status(400).json({ 
      error: 'File type not allowed',
      details: 'Executable files cannot be uploaded'
    });
  }
  
  next();
};

const validateRole = (req, res, next) => {
  const { role } = req.body;
  
  const validRoles = ['super_admin', 'org_owner', 'org_admin', 'workspace_admin', 'manager', 'member', 'viewer'];
  
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }
  
  const normalizedRole = role.toLowerCase();
  
  if (!validRoles.includes(normalizedRole)) {
    return res.status(400).json({ 
      error: 'Invalid role',
      details: `Role must be one of: ${validRoles.join(', ')}`
    });
  }
  
  req.body.role = normalizedRole;
  next();
};

const validatePriority = (req, res, next) => {
  const { priority } = req.body;
  
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  
  if (priority && !validPriorities.includes(priority.toLowerCase())) {
    return res.status(400).json({ 
      error: 'Invalid priority',
      details: `Priority must be one of: ${validPriorities.join(', ')}`
    });
  }
  
  if (priority) {
    req.body.priority = priority.toLowerCase();
  }
  
  next();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateStringLength,
  validateUUID,
  sanitizeHtml,
  validateFileUpload,
  validateRole,
  validatePriority
};
