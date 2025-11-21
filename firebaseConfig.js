const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;

if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
  try {
    serviceAccount = require('/etc/secrets/serviceAccount.json');
    console.log('Firebase credentials loaded from Render secrets');
  } catch (error) {
    console.error('Failed to load Firebase credentials from Render secrets');
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('Firebase credentials loaded from environment variable');
    }
  }
} else {
  try {
    serviceAccount = require('./cloudcollab-3d898-firebase-adminsdk-fbsvc-72a59c38b1.json');
    console.log('Firebase credentials loaded from local file');
  } catch (error) {
    console.error('Failed to load local Firebase credentials');
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'cloudcollab-3d898.appspot.com'
  });
  console.log('Firebase Admin initialized');
}

module.exports = {
  admin,
  db: admin.firestore(),
  auth: admin.auth(),
  storage: admin.storage(),
  
  config: {
    apiKey: "AIzaSyD69TUwJxFFTYssEOtpxeCawYIwgzWCY2k",
    authDomain: "cloudcollab-3d898.firebaseapp.com", 
    projectId: "cloudcollab-3d898",
    storageBucket: "cloudcollab-3d898.appspot.com",
    messagingSenderId: "58715000101",
    appId: "1:58715000101:web:73b03fccf29ed693cd1ecc"
  }
};