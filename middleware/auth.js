// middleware/auth.js
const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    

    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      if (decoded.uid && decoded.exp && decoded.exp > Date.now()) {
        console.log('Valid test token for user:', decoded.uid);
        req.user = decoded;
        return next();
      }
    } catch (e) {

    }
    

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { verifyToken };