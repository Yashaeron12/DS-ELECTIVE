// firebaseConfig.js
const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;

// Check if running on Render (production)
if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
  // On Render, read from the secret file path
  try {
    serviceAccount = require('/etc/secrets/serviceAccount.json');
    console.log('✅ Firebase credentials loaded from Render secrets');
  } catch (error) {
    console.error('❌ Failed to load Firebase credentials from Render secrets');
    // Fallback: try to parse from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Firebase credentials loaded from environment variable');
    }
  }
} else {
  // Local development - use the local file
  try {
    serviceAccount = require('./cloudcollab-3d898-firebase-adminsdk-fbsvc-72a59c38b1.json');
    console.log('✅ Firebase credentials loaded from local file');
  } catch (error) {
    console.error('❌ Failed to load local Firebase credentials');
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'cloudcollab-3d898.appspot.com'
  });
  console.log('🔥 Firebase Admin initialized');
}

// Export Firebase services
module.exports = {
  admin,
  db: admin.firestore(),
  auth: admin.auth(),
  storage: admin.storage(),
  
  // Keep original config for reference
  config: {
    apiKey: "AIzaSyD69TUwJxFFTYssEOtpxeCawYIwgzWCY2k",
    authDomain: "cloudcollab-3d898.firebaseapp.com", 
    projectId: "cloudcollab-3d898",
    storageBucket: "cloudcollab-3d898.appspot.com",
    messagingSenderId: "58715000101",
    appId: "1:58715000101:web:73b03fccf29ed693cd1ecc"
  }
};