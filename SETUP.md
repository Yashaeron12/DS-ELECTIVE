# CloudCollab Backend Setup Guide

Quick setup guide for getting the CloudCollab Backend API running on your system.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd Projectelective
npm install
```

### 2. Start the Backend Server
```bash
npm start
# or for development with auto-restart
npm run dev
```

### 3. Access the API
- **API Base URL**: http://localhost:5000/api
- **API Documentation**: http://localhost:5000 (shows endpoint list)
- **Health Check**: http://localhost:5000/health
- **API Test Interface**: http://localhost:5000/test.html

## 🧪 Testing the Backend API

### Using the API Test Interface
1. Go to http://localhost:5000/test.html
2. Click "Test Registration" to create a test user
3. Click "Test Login" to get authentication token
4. Test other API endpoints in sequence:
   - Create Task
   - Get Tasks
   - Update Task
   - Delete Task
   - Toggle Task Completion

### Using curl or Postman

#### 1. Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "displayName": "Test User"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

#### 3. Create a Task (use token from login response)
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Test Task",
    "description": "This is a test task",
    "priority": "high",
    "category": "testing"
  }'
```

#### 4. Get All Tasks
```bash
curl -X GET http://localhost:5000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### 5. Upload a File
```bash
curl -X POST http://localhost:5000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@/path/to/your/file.pdf" \
  -F "description=Test file upload"
```

## 📋 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login  
- `POST /api/auth/test-login` - Test login (development)

### Tasks
- `GET /api/tasks` - Get user's tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/complete` - Toggle completion

### Files
- `GET /api/files` - Get user's files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id/download` - Download file
- `PUT /api/files/:id` - Update file metadata
- `DELETE /api/files/:id` - Delete file
- `POST /api/files/:id/share` - Share file with user
- `GET /api/files/shared` - Get shared files

### Workspaces/Teams
- `GET /api/workspaces` - Get user's workspaces
- `POST /api/workspaces` - Create workspace
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `POST /api/workspaces/:id/invite` - Invite member
- `GET /api/workspaces/:id/members` - Get members
- `DELETE /api/workspaces/:id/members/:memberId` - Remove member

## 🔧 Configuration

### Required Environment Variables
```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=cloudcollab-3d898
```

### Firebase Setup (Optional for basic testing)
The backend includes test authentication that works without full Firebase setup. For production:

1. Create Firebase project
2. Enable Authentication, Firestore, Storage
3. Download service account key
4. Place as `cloudcollab-3d898-firebase-adminsdk-fbsvc-72a59c38b1.json`

## 🐛 Troubleshooting

### Server won't start
```bash
# Check Node.js version
node --version

# Install dependencies
npm install

# Check if port 5000 is available
netstat -an | findstr :5000
```

### API calls failing
1. Ensure server is running on port 5000
2. Check authentication token in requests
3. Verify request headers (Content-Type, Authorization)
4. Check server logs for error details

### File uploads not working
1. Check file size (max 10MB)
2. Ensure multipart/form-data content type
3. Verify authentication token
4. Check supported file types

## 📊 Response Format

### Success Response
```json
{
  "id": "resource_id",
  "message": "Operation successful",
  "data": {...}
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

## 🎯 Integration Examples

### JavaScript (Frontend)
```javascript
// Register user
const response = await fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    displayName: 'User Name'
  })
});

// Get tasks with authentication
const tasks = await fetch('http://localhost:5000/api/tasks', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Python
```python
import requests

# Login
response = requests.post('http://localhost:5000/api/auth/test-login', 
  json={'email': 'test@example.com'})
token = response.json()['token']

# Get tasks
tasks = requests.get('http://localhost:5000/api/tasks', 
  headers={'Authorization': f'Bearer {token}'})
```

The backend is now ready to handle all collaborative workspace operations! 🚀