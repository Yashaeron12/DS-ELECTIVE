# CloudCollab Backend API

A complete REST API server for collaborative workspace management featuring task management, file sharing, and team collaboration - the backend for applications like Microsoft Teams or Slack.

## 🌟 Features

### ✅ Task Management API
- Create, read, update, delete tasks with priorities and categories
- Toggle completion status
- Task filtering and organization
- User-specific task isolation

### 📁 File Storage & Sharing API
- Upload files with Firebase Storage integration
- Secure file access with proper permissions
- File sharing between users with role-based access
- Download tracking and metadata management
- Support for multiple file types (images, documents, videos, etc.)

### 👥 Team Collaboration API
- Create and manage workspaces/teams
- Invite members with different roles (owner, admin, member)
- Private and public workspace options
- Member management and permissions

### 🔐 Security
- Firebase Authentication integration
- JWT token-based API authentication
- Role-based access control for workspaces
- Secure file access with proper permissions
- User data isolation and validation

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express.js** - REST API server
- **Firebase Admin SDK** - Authentication & database
- **Firebase Firestore** - Real-time NoSQL database
- **Firebase Storage** - Secure file storage
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### Database Schema
- **Users** - User profiles and authentication
- **Tasks** - Task management with user associations
- **Files** - File metadata and storage references
- **Workspaces** - Team/workspace management
- **WorkspaceMembers** - Member roles and permissions
- **FileShares** - File sharing permissions

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Firebase project with Firestore and Storage enabled (optional for basic testing)
- Firebase Admin SDK service account key (for production)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cloudcollab-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup (Optional)**
   - For basic testing, the API works with built-in test authentication
   - For production: Create a Firebase project, enable services, download service account key
   - Place service account key as `cloudcollab-3d898-firebase-adminsdk-fbsvc-72a59c38b1.json`

4. **Run the API server**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Test the API**
   - **API Base**: http://localhost:5000/api
   - **Documentation**: http://localhost:5000 (shows all endpoints)
   - **Health Check**: http://localhost:5000/health
   - **Test Interface**: http://localhost:5000/test.html

## 📖 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
Most endpoints require a Bearer token:
```
Authorization: Bearer <token>
```

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/test-login` - Test login (development)

#### Task Management
- `GET /api/tasks` - Get user's tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/complete` - Toggle task completion

#### File Management
- `GET /api/files` - Get user's files
- `POST /api/files/upload` - Upload new file
- `GET /api/files/:id/download` - Download file
- `PUT /api/files/:id` - Update file metadata
- `DELETE /api/files/:id` - Delete file
- `POST /api/files/:id/share` - Share file with user
- `GET /api/files/shared` - Get files shared with user

#### Workspace Management
- `GET /api/workspaces` - Get user's workspaces
- `POST /api/workspaces` - Create new workspace
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `POST /api/workspaces/:id/invite` - Invite user to workspace
- `GET /api/workspaces/:id/members` - Get workspace members
- `DELETE /api/workspaces/:id/members/:memberId` - Remove member

See `API_DOCUMENTATION.md` for complete API reference with examples.

## 🧪 Testing

### Using the Test Interface
1. Start the server: `npm start`
2. Open http://localhost:5000/test.html
3. Test registration → login → create tasks → upload files

### Using curl
```bash
# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'

# Login
curl -X POST http://localhost:5000/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Create task (use token from login)
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"Test Task","description":"API test","priority":"high"}'
```

## 📁 Project Structure

```
cloudcollab-backend/
├── server.js                 # Main Express server
├── package.json              # Dependencies and scripts
├── firebaseConfig.js         # Firebase configuration
├── routes/
│   ├── tasks.js             # Task management routes
│   ├── files.js             # File management routes
│   └── workspaces.js        # Workspace management routes
├── middleware/
│   └── auth.js              # Authentication middleware
├── controllers/
│   └── taskController.js    # Task business logic
├── test.html                # API testing interface
├── API_DOCUMENTATION.md     # Complete API reference
└── SETUP.md                 # Setup instructions
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file:

```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=cloudcollab-3d898
```

### CORS Configuration
The API accepts requests from common development ports:
- localhost:3000 (React)
- localhost:8080 (Vue)
- localhost:3001 (Next.js)
- localhost:5000 (Backend)

## 🔒 Security Features

- JWT token authentication with Firebase
- Role-based access control for workspaces
- File permission validation
- User data isolation
- Request size limits (10MB)
- CORS protection
- Input validation and sanitization

## 🚀 Deployment

### Local Production
```bash
npm start
```

### Heroku
1. Create Heroku app
2. Set environment variables
3. Deploy:
   ```bash
   git add .
   git commit -m "Deploy backend API"
   git push heroku main
   ```

### Docker
```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Integration

### Frontend Integration
This backend can be integrated with any frontend framework:

- **React/Vue/Angular** - Use fetch/axios for API calls
- **Mobile Apps** - REST API compatible with iOS/Android
- **Desktop Apps** - Electron or native apps can consume the API
- **Other Backends** - Microservices can interact via REST

### Example Integration
```javascript
// JavaScript frontend example
const api = 'http://localhost:5000/api';
const token = localStorage.getItem('authToken');

// Get tasks
const response = await fetch(`${api}/tasks`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const tasks = await response.json();
```

## 🆘 Troubleshooting

### Common Issues

1. **Server won't start**
   - Check Node.js version: `node --version`
   - Install dependencies: `npm install`
   - Check port availability: `netstat -an | findstr :5000`

2. **Authentication errors**
   - Use test-login endpoint for development
   - Verify token format in Authorization header
   - Check token expiration

3. **File upload fails**
   - Verify file size under 10MB
   - Check Content-Type: multipart/form-data
   - Ensure proper authentication

### Debug Mode
Set `NODE_ENV=development` for detailed error messages.

## 📧 Support

For issues and questions, please check:
1. API_DOCUMENTATION.md for endpoint details
2. SETUP.md for installation help
3. test.html for working examples

---

**CloudCollab Backend** - Complete REST API for collaborative workspaces! 🚀