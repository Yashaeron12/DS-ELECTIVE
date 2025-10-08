// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// --- CONFIG AND ROUTE IMPORTS ---
const serviceAccount = require('./cloudcollab-3d898-firebase-adminsdk-fbsvc-60b9f4552e.json'); // <-- IMPORTANT: UPDATE THIS
const firebaseConfig = require('./firebaseConfig');
const taskRoutes = require('./routes/tasks');

// --- INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 5000;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = admin.firestore();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.get('/', (req, res) => res.send('CloudCollab API is running!'));

// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const userRecord = await admin.auth().createUser({ email, password, displayName });
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: userRecord.displayName,
      createdAt: new Date().toISOString(),
    });
    res.status(201).send({ message: 'User created successfully', uid: userRecord.uid });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// User Login (for getting a token)
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    res.status(200).send({ message: 'Login successful', token: idToken });
  } catch (error) {
    res.status(401).send({ error: 'Invalid credentials' });
  }
});

// Task Management Routes
app.use('/api/tasks', taskRoutes);

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});