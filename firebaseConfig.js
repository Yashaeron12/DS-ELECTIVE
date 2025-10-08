// firebaseConfig.js
// Fill this with your web app's Firebase configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD69TUwJxFFTYssEOtpxeCawYIwgzWCY2k",
  authDomain: "cloudcollab-3d898.firebaseapp.com",
  projectId: "cloudcollab-3d898",
  storageBucket: "cloudcollab-3d898.firebasestorage.app",
  messagingSenderId: "58715000101",
  appId: "1:58715000101:web:73b03fccf29ed693cd1ecc",
  measurementId: "G-JFE3C4PV7P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);