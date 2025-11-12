# CloudCollab - Collaborative Workspace Platform# CloudCollab Backend API



A complete full-stack application for collaborative workspace management featuring real-time task management, file sharing, and team collaboration - similar to Microsoft Teams or Slack. Built with React frontend and Node.js/Express backend with Firebase integration.A complete REST API server for collaborative workspace management featuring task management, file sharing, and team collaboration - the backend for applications like Microsoft Teams or Slack.



## 🌟 Features## 🌟 Features



### 🎯 Complete Application Stack### ✅ Task Management API

- Create, read, update, delete tasks with priorities and categories

#### ✅ Task Management- Toggle completion status

- Create, read, update, delete tasks with priorities and categories- Task filtering and organization

- Toggle completion status- User-specific task isolation

- Task filtering and organization

- Workspace-based task isolation### 📁 File Storage & Sharing API

- Real-time task updates via WebSocket- Upload files with Firebase Storage integration

- Secure file access with proper permissions

#### 📁 File Storage & Sharing- File sharing between users with role-based access

- Upload files with Firebase Storage integration- Download tracking and metadata management

- Secure file access with proper permissions- Support for multiple file types (images, documents, videos, etc.)

- File sharing between users with role-based access

- Download tracking and metadata management### 👥 Team Collaboration API

- Support for multiple file types (images, documents, videos, etc.)- Create and manage workspaces/teams

- Invite members with different roles (owner, admin, member)

#### 👥 Organization & Team Collaboration- Private and public workspace options

- Multi-tenant organization system- Member management and permissions

- Create and manage workspaces/teams

- Organization-wide member invitations### 🔐 Security

- Invite members with different roles (owner, admin, member)- Firebase Authentication integration

- Private and public workspace options- JWT token-based API authentication

- Member management and permissions- Role-based access control for workspaces

- Real-time collaboration via Socket.IO- Secure file access with proper permissions

- User data isolation and validation

#### 🔐 Enterprise-Grade Security

- Firebase Authentication integration## 🛠️ Tech Stack

- JWT token-based API authentication

- Role-based access control (RBAC) for organizations and workspaces### Backend

- Case-insensitive role normalization- **Node.js** + **Express.js** - REST API server

- Input validation with validator library- **Firebase Admin SDK** - Authentication & database

- Rate limiting on all endpoints (auth, API, uploads)- **Firebase Firestore** - Real-time NoSQL database

- File permission validation- **Firebase Storage** - Secure file storage

- User data isolation- **Multer** - File upload handling

- Request size limits- **CORS** - Cross-origin resource sharing

- CORS protection with environment-based whitelisting

### Database Schema

#### 🎨 Modern React Frontend- **Users** - User profiles and authentication

- Material-UI components- **Tasks** - Task management with user associations

- Responsive design- **Files** - File metadata and storage references

- Real-time updates- **Workspaces** - Team/workspace management

- Organization onboarding flow- **WorkspaceMembers** - Member roles and permissions

- Invitation management- **FileShares** - File sharing permissions

- Dashboard with workspace overview

- Task and file management interfaces## 🚀 Getting Started

- Team collaboration tools

### Prerequisites

---- Node.js (v14 or higher)

- Firebase project with Firestore and Storage enabled (optional for basic testing)

## 🛠️ Tech Stack- Firebase Admin SDK service account key (for production)



### Frontend### Installation

- **React 18** - UI framework

- **Material-UI (MUI)** - Component library1. **Clone the repository**

- **Axios** - HTTP client   ```bash

- **React Router** - Navigation   git clone <repository-url>

- **Firebase SDK** - Authentication   cd cloudcollab-backend

   ```

### Backend

- **Node.js** + **Express.js** - REST API server2. **Install dependencies**

- **Firebase Admin SDK** - Authentication & database   ```bash

- **Firebase Firestore** - Real-time NoSQL database   npm install

- **Firebase Storage** - Secure file storage   ```

- **Socket.IO** - Real-time bidirectional communication

- **Multer** - File upload handling3. **Firebase Setup (Optional)**

- **Express Rate Limit** - API throttling   - For basic testing, the API works with built-in test authentication

- **Validator** - Input validation   - For production: Create a Firebase project, enable services, download service account key

- **CORS** - Cross-origin resource sharing   - Place service account key as `cloudcollab-3d898-firebase-adminsdk-fbsvc-72a59c38b1.json`



### Database Schema4. **Run the API server**

- **Users** - User profiles, authentication, and organization roles   ```bash

- **Organizations** - Multi-tenant organizations with settings   # Development mode with auto-restart

- **OrganizationInvitations** - Pending member invitations   npm run dev

- **Workspaces** - Team/workspace management   

- **WorkspaceMembers** - Member roles and permissions   # Production mode

- **Tasks** - Task management with workspace associations   npm start

- **Files** - File metadata and storage references   ```

- **FileShares** - File sharing permissions

5. **Test the API**

---   - **API Base**: http://localhost:5000/api

   - **Documentation**: http://localhost:5000 (shows all endpoints)

## 🚀 Getting Started   - **Health Check**: http://localhost:5000/health

   - **Test Interface**: http://localhost:5000/test.html

### Prerequisites

- **Node.js** (v14 or higher)## 📖 API Documentation

- **npm** or **yarn**

- **Firebase project** with Firestore, Storage, and Authentication enabled### Base URL

- **Firebase Admin SDK service account key**```

http://localhost:5000/api

### Installation```



#### 1. Clone the Repository### Authentication

```bashMost endpoints require a Bearer token:

git clone https://github.com/Yashaeron12/DS-ELECTIVE.git```

cd DS-ELECTIVEAuthorization: Bearer <token>

``````



#### 2. Backend Setup### Key Endpoints

```bash

# Install backend dependencies#### Authentication

npm install- `POST /api/auth/register` - Register new user

- `POST /api/auth/login` - User login

# Firebase Setup- `POST /api/auth/test-login` - Test login (development)

# 1. Create a Firebase project at https://console.firebase.google.com

# 2. Enable Firestore, Storage, and Authentication (Email/Password)#### Task Management

# 3. Go to Project Settings > Service Accounts- `GET /api/tasks` - Get user's tasks

# 4. Generate new private key- `POST /api/tasks` - Create new task

# 5. Save the JSON file as cloudcollab-*-firebase-adminsdk-*.json in project root- `PUT /api/tasks/:id` - Update task

- `DELETE /api/tasks/:id` - Delete task

# Create .env file (optional)- `PATCH /api/tasks/:id/complete` - Toggle task completion

echo "PORT=5000" > .env

echo "NODE_ENV=development" >> .env#### File Management

echo "FIREBASE_PROJECT_ID=your-project-id" >> .env- `GET /api/files` - Get user's files

- `POST /api/files/upload` - Upload new file

# Start backend server- `GET /api/files/:id/download` - Download file

npm start- `PUT /api/files/:id` - Update file metadata

```- `DELETE /api/files/:id` - Delete file

- `POST /api/files/:id/share` - Share file with user

Backend will run on **http://localhost:5000**- `GET /api/files/shared` - Get files shared with user



#### 3. Frontend Setup#### Workspace Management

```bash- `GET /api/workspaces` - Get user's workspaces

cd cloudcollab-frontend- `POST /api/workspaces` - Create new workspace

- `PUT /api/workspaces/:id` - Update workspace

# Install frontend dependencies- `DELETE /api/workspaces/:id` - Delete workspace

npm install- `POST /api/workspaces/:id/invite` - Invite user to workspace

- `GET /api/workspaces/:id/members` - Get workspace members

# Create Firebase config (frontend/src/firebaseConfig.js)- `DELETE /api/workspaces/:id/members/:memberId` - Remove member

# Copy your Firebase web app configuration from Firebase Console

See `API_DOCUMENTATION.md` for complete API reference with examples.

# Start frontend development server

npm start## 🧪 Testing

```

### Using the Test Interface

Frontend will run on **http://localhost:3000**1. Start the server: `npm start`

2. Open http://localhost:5000/test.html

#### 4. Access the Application3. Test registration → login → create tasks → upload files

- **Frontend**: http://localhost:3000

- **Backend API**: http://localhost:5000/api### Using curl

- **API Health Check**: http://localhost:5000/health```bash

# Register user

---curl -X POST http://localhost:5000/api/auth/register \

  -H "Content-Type: application/json" \

## 📖 API Documentation  -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'



### Base URL# Login

```curl -X POST http://localhost:5000/api/auth/test-login \

http://localhost:5000/api  -H "Content-Type: application/json" \

```  -d '{"email":"test@example.com"}'



### Authentication# Create task (use token from login)

Most endpoints require a Bearer token in the Authorization header:curl -X POST http://localhost:5000/api/tasks \

```  -H "Content-Type: application/json" \

Authorization: Bearer <firebase-id-token>  -H "Authorization: Bearer <token>" \

```  -d '{"title":"Test Task","description":"API test","priority":"high"}'

```

### Core Endpoints

## 📁 Project Structure

#### 🔐 Authentication (`/api/auth`)

- `POST /register` - Register new user```

- `POST /login` - User login (returns Firebase token)cloudcollab-backend/

├── server.js                 # Main Express server

#### 🏢 Organizations (`/api/organizations`)├── package.json              # Dependencies and scripts

- `GET /` - Get user's organizations├── firebaseConfig.js         # Firebase configuration

- `POST /` - Create new organization├── routes/

- `PUT /:id` - Update organization│   ├── tasks.js             # Task management routes

- `POST /:id/invite` - Invite members to organization│   ├── files.js             # File management routes

- `GET /invitations` - Get pending invitations│   └── workspaces.js        # Workspace management routes

- `POST /invitations/:id/accept` - Accept invitation├── middleware/

- `POST /invitations/:id/decline` - Decline invitation│   └── auth.js              # Authentication middleware

├── controllers/

#### 📊 Workspaces (`/api/workspaces`)│   └── taskController.js    # Task business logic

- `GET /` - Get user's workspaces├── test.html                # API testing interface

- `POST /` - Create new workspace├── API_DOCUMENTATION.md     # Complete API reference

- `PUT /:id` - Update workspace└── SETUP.md                 # Setup instructions

- `DELETE /:id` - Delete workspace```

- `GET /:id/members` - Get workspace members

- `POST /:id/members` - Add member to workspace## 🔧 Configuration

- `DELETE /:id/members/:memberId` - Remove member

### Environment Variables

#### ✅ Tasks (`/api/tasks`)Create a `.env` file:

- `GET /` - Get workspace tasks

- `POST /` - Create new task```env

- `PUT /:id` - Update taskPORT=5000

- `DELETE /:id` - Delete taskNODE_ENV=development

- `PATCH /:id/complete` - Toggle task completionFIREBASE_PROJECT_ID=cloudcollab-3d898

```

#### 📁 Files (`/api/files`)

- `POST /upload` - Upload file### CORS Configuration

- `GET /:id/download` - Download fileThe API accepts requests from common development ports:

- `PUT /:id` - Update file metadata- localhost:3000 (React)

- `DELETE /:id` - Delete file- localhost:8080 (Vue)

- `POST /:id/share` - Share file with user- localhost:3001 (Next.js)

- `GET /shared` - Get files shared with user- localhost:5000 (Backend)



#### 👥 Admin (`/api/admin`)## 🔒 Security Features

- Organization management

- User role administration- JWT token authentication with Firebase

- System configuration- Role-based access control for workspaces

- File permission validation

See **API_DOCUMENTATION.md** for complete API reference with request/response examples.- User data isolation

- Request size limits (10MB)

---- CORS protection

- Input validation and sanitization

## 📁 Project Structure

## 🚀 Deployment

```

cloudcollab/### Local Production

├── server.js                    # Main Express server```bash

├── package.json                 # Backend dependenciesnpm start

├── firebaseConfig.js            # Firebase Admin configuration```

├── .gitignore                   # Git ignore rules

├── routes/### Heroku

│   ├── auth.js                 # Authentication endpoints1. Create Heroku app

│   ├── organizations.js        # Organization management2. Set environment variables

│   ├── workspaces.js          # Workspace CRUD3. Deploy:

│   ├── tasks.js               # Task management   ```bash

│   ├── files.js               # File operations   git add .

│   └── admin.js               # Admin operations   git commit -m "Deploy backend API"

├── middleware/   git push heroku main

│   ├── auth.js                # JWT authentication   ```

│   ├── rbac.js                # Role-based access control

│   ├── validation.js          # Input validation### Docker

│   └── rateLimiter.js         # Rate limiting```dockerfile

├── services/FROM node:16

│   └── socketService.js       # WebSocket/Socket.IO handlingWORKDIR /app

├── cloudcollab-frontend/COPY package*.json ./

│   ├── package.json           # Frontend dependenciesRUN npm install

│   ├── public/COPY . .

│   │   └── index.html        # HTML templateEXPOSE 5000

│   └── src/CMD ["npm", "start"]

│       ├── App.js            # Main React component```

│       ├── components/       # React components

│       │   ├── AdminPanel.js## 🤝 Integration

│       │   ├── Dashboard.js

│       │   ├── TaskManager.js### Frontend Integration

│       │   ├── TeamManager.jsThis backend can be integrated with any frontend framework:

│       │   ├── FileManager.js

│       │   ├── WorkspaceManager.js- **React/Vue/Angular** - Use fetch/axios for API calls

│       │   ├── OrganizationOnboarding.js- **Mobile Apps** - REST API compatible with iOS/Android

│       │   └── OrganizationInvitations.js- **Desktop Apps** - Electron or native apps can consume the API

│       ├── contexts/         # React contexts- **Other Backends** - Microservices can interact via REST

│       │   └── AuthContext.js

│       └── services/         # API services### Example Integration

│           └── api.js```javascript

├── API_DOCUMENTATION.md       # Detailed API docs// JavaScript frontend example

├── SETUP.md                   # Setup guideconst api = 'http://localhost:5000/api';

├── CODE_AUDIT_REPORT.md       # Security audit reportconst token = localStorage.getItem('authToken');

└── DEMO_WALKTHROUGH.md        # Feature demonstration guide

```// Get tasks

const response = await fetch(`${api}/tasks`, {

---  headers: { 'Authorization': `Bearer ${token}` }

});

## 🔧 Configurationconst tasks = await response.json();

```

### Environment Variables

## 🆘 Troubleshooting

Backend (`.env`):

```env### Common Issues

PORT=5000

NODE_ENV=development1. **Server won't start**

FIREBASE_PROJECT_ID=cloudcollab-3d898   - Check Node.js version: `node --version`

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001   - Install dependencies: `npm install`

```   - Check port availability: `netstat -an | findstr :5000`



### Firebase Configuration2. **Authentication errors**

   - Use test-login endpoint for development

**Backend** (`firebaseConfig.js`):   - Verify token format in Authorization header

- Uses Firebase Admin SDK with service account credentials   - Check token expiration

- Automatically initialized from JSON file

3. **File upload fails**

**Frontend** (`src/firebaseConfig.js`):   - Verify file size under 10MB

```javascript   - Check Content-Type: multipart/form-data

export const firebaseConfig = {   - Ensure proper authentication

  apiKey: "your-api-key",

  authDomain: "your-project.firebaseapp.com",### Debug Mode

  projectId: "your-project-id",Set `NODE_ENV=development` for detailed error messages.

  storageBucket: "your-project.appspot.com",

  messagingSenderId: "your-sender-id",## 📧 Support

  appId: "your-app-id"

};For issues and questions, please check:

```1. API_DOCUMENTATION.md for endpoint details

2. SETUP.md for installation help

### CORS Configuration3. test.html for working examples

Environment-aware CORS whitelist supporting:

- Development: localhost:3000, localhost:3001, localhost:5000---

- Production: Add production URLs to environment variables

**CloudCollab Backend** - Complete REST API for collaborative workspaces! 🚀
---

## 🔒 Security Features

### ✅ Implemented Security Measures

1. **Authentication & Authorization**
   - Firebase JWT token verification
   - Role-based access control (RBAC)
   - Organization-level and workspace-level permissions
   - Case-insensitive role normalization

2. **Input Validation**
   - Email format validation
   - Password strength requirements
   - String length limits
   - UUID format validation
   - File upload validation

3. **Rate Limiting**
   - Auth endpoints: 5 requests/15min
   - API endpoints: 100 requests/15min
   - Upload endpoints: 10 requests/15min
   - Invitation endpoints: 20 requests/hour

4. **Data Protection**
   - User data isolation
   - Firestore security rules
   - File access permissions
   - Request size limits (10MB)
   - No sensitive data in logs

5. **Network Security**
   - CORS with environment-based whitelist
   - HTTPS recommended for production
   - Secure cookie handling

---

## 🧪 Testing

### Quick Start Testing

1. **Start the servers**:
   ```bash
   # Terminal 1: Backend
   npm start
   
   # Terminal 2: Frontend
   cd cloudcollab-frontend
   npm start
   ```

2. **Register and test**:
   - Navigate to http://localhost:3000
   - Register a new account
   - Create an organization
   - Create workspaces
   - Invite team members
   - Manage tasks and files

### Demo Accounts

Use these for testing (create via registration):
- Admin: `admin@cloudcollab.com`
- User: `user@cloudcollab.com`

---

## 🚀 Deployment

### Backend Deployment

#### Heroku
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set PORT=5000
heroku config:set FIREBASE_PROJECT_ID=your-project-id

# Upload Firebase credentials
# (Use Heroku Config Vars for JSON content)

# Deploy
git push heroku main
```

#### Railway / Render
1. Connect GitHub repository
2. Set environment variables
3. Add Firebase service account JSON as secret
4. Deploy

### Frontend Deployment

#### Vercel
```bash
cd cloudcollab-frontend
npm run build

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Netlify
```bash
cd cloudcollab-frontend
npm run build

# Deploy build folder via Netlify CLI or drag-and-drop
```

---

## 🤝 Contributing

### Team Members
- **Yash Aeron** - Backend Architecture & API Development
- **Shefali Yadav** - Cloud Infrastructure & Quality Assurance
- **Hardik Pant** - Frontend Development & User Interface Design

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- ESLint for code quality
- Consistent naming conventions
- Comprehensive comments
- Error handling on all async operations

---

## 📝 Documentation

- **API_DOCUMENTATION.md** - Complete API reference
- **SETUP.md** - Detailed setup instructions
- **CODE_AUDIT_REPORT.md** - Security audit findings
- **DEMO_WALKTHROUGH.md** - Feature demonstrations

---

## 🆘 Troubleshooting

### Common Issues

**Backend won't start**
```bash
# Check Node.js version
node --version  # Should be v14+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check port availability
netstat -an | findstr :5000  # Windows
lsof -i :5000  # Mac/Linux
```

**Frontend compilation errors**
```bash
cd cloudcollab-frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

**Authentication errors**
- Verify Firebase config in both frontend and backend
- Check service account JSON file is present
- Ensure user is registered in Firebase Authentication

**Workspace/Organization issues**
- Check user has proper roles in Firestore
- Verify RBAC middleware is functioning
- Review browser console for detailed errors

### Debug Mode
```bash
# Backend debug logging
NODE_ENV=development npm start

# Frontend debug
REACT_APP_DEBUG=true npm start
```

---

## 📧 Support

For issues and questions:
1. Check documentation files
2. Review Firebase console for auth/database issues
3. Check browser console for frontend errors
4. Open a GitHub issue with error details

---

## 📄 License

This project is part of the **DS-ELECTIVE** (Data Structures - Elective) coursework.

---

## 🎯 Project Highlights

✅ Full-stack MERN-like architecture (React + Node.js + Firebase)  
✅ Real-time collaboration with Socket.IO  
✅ Enterprise-grade security (RBAC, validation, rate limiting)  
✅ Multi-tenant organization system  
✅ Comprehensive API documentation  
✅ Modern UI with Material-UI  
✅ Production-ready deployment guides  

---

**CloudCollab** - Where teams collaborate seamlessly! 🚀

*Built with React, Node.js, Express, Firebase, Socket.IO, and Material-UI.*

---

**Repository**: https://github.com/Yashaeron12/DS-ELECTIVE  
**Live Demo**: [Coming Soon]
