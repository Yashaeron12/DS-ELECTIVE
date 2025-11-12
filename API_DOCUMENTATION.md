# CloudCollab Backend API

A complete REST API for collaborative workspace management with task management, file sharing, and team collaboration features.

## 🚀 Features

- **User Authentication** - Registration, login with Firebase Auth
- **Task Management** - CRUD operations for tasks with priorities
- **File Storage** - Upload, download, share files with Firebase Storage
- **Team Collaboration** - Workspace management with role-based permissions
- **Real-time Database** - Firebase Firestore for instant data sync

## 🛠️ Tech Stack

- **Node.js** + **Express.js** - REST API server
- **Firebase Admin SDK** - Authentication & database
- **Firebase Firestore** - NoSQL database
- **Firebase Storage** - File storage
- **Multer** - File upload handling

## 📖 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All endpoints except registration and login require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "uid": "user_id",
  "email": "user@example.com",
  "displayName": "John Doe"
}
```

### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "uid": "user_id",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

### Test Login (Development)
```http
POST /api/auth/test-login
Content-Type: application/json

{
  "email": "user@example.com"
}
```

---

## ✅ Task Management Endpoints

### Get All Tasks
```http
GET /api/tasks
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "task_id",
    "title": "Complete project",
    "description": "Finish the backend API",
    "priority": "high",
    "category": "work",
    "completed": false,
    "userId": "user_id",
    "createdAt": "2025-10-28T10:00:00Z",
    "updatedAt": "2025-10-28T10:00:00Z"
  }
]
```

### Create Task
```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "New Task",
  "description": "Task description",
  "priority": "medium",
  "category": "personal",
  "dueDate": "2025-10-30"
}
```

### Update Task
```http
PUT /api/tasks/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Task Title",
  "description": "Updated description",
  "priority": "high",
  "completed": true
}
```

### Delete Task
```http
DELETE /api/tasks/:id
Authorization: Bearer <token>
```

### Toggle Task Completion
```http
PATCH /api/tasks/:id/complete
Authorization: Bearer <token>
```

---

## 📁 File Management Endpoints

### Get All Files
```http
GET /api/files
Authorization: Bearer <token>
```

**Query Parameters:**
- `workspaceId` (optional) - Filter by workspace

### Upload File
```http
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file_data>
description: "File description"
isPublic: false
workspaceId: "workspace_id" (optional)
```

**Response:**
```json
{
  "id": "file_id",
  "message": "File uploaded successfully",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "downloadUrl": "signed_url",
  "uploadedBy": "user_id"
}
```

### Download File
```http
GET /api/files/:id/download
Authorization: Bearer <token>
```

### Update File Metadata
```http
PUT /api/files/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "isPublic": true
}
```

### Delete File
```http
DELETE /api/files/:id
Authorization: Bearer <token>
```

### Share File
```http
POST /api/files/:id/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "userEmail": "recipient@example.com",
  "permission": "read"
}
```

### Get Shared Files
```http
GET /api/files/shared
Authorization: Bearer <token>
```

---

## 👥 Workspace Management Endpoints

### Get All Workspaces
```http
GET /api/workspaces
Authorization: Bearer <token>
```

### Create Workspace
```http
POST /api/workspaces
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Team",
  "description": "Team workspace",
  "isPrivate": true
}
```

### Update Workspace
```http
PUT /api/workspaces/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Team Name",
  "description": "Updated description",
  "isPrivate": false
}
```

### Delete Workspace
```http
DELETE /api/workspaces/:id
Authorization: Bearer <token>
```

### Invite User to Workspace
```http
POST /api/workspaces/:id/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "userEmail": "newmember@example.com",
  "role": "member"
}
```

**Roles:** `owner`, `admin`, `member`

### Get Workspace Members
```http
GET /api/workspaces/:id/members
Authorization: Bearer <token>
```

### Remove Member
```http
DELETE /api/workspaces/:id/members/:memberId
Authorization: Bearer <token>
```

---

## 🔧 Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (development only)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Environment Setup
Create `.env` file:
```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
```

### Run Server
```bash
# Development
npm run dev

# Production
npm start
```

### Health Check
```http
GET /health
```

Returns server status and Firebase connection info.

---

## 📋 Data Models

### User
```json
{
  "uid": "string",
  "email": "string",
  "displayName": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Task
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "priority": "low|medium|high",
  "category": "string",
  "completed": "boolean",
  "userId": "string",
  "dueDate": "string|null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### File
```json
{
  "id": "string",
  "fileName": "string",
  "fileSize": "number",
  "mimeType": "string",
  "storagePath": "string",
  "downloadUrl": "string",
  "uploadedBy": "string",
  "workspaceId": "string|null",
  "description": "string",
  "isPublic": "boolean",
  "downloadCount": "number",
  "uploadedAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Workspace
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "ownerId": "string",
  "isPrivate": "boolean",
  "memberCount": "number",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 🔒 Security Features

- JWT token authentication
- Role-based access control
- File permission validation
- User data isolation
- CORS protection
- Request size limits (10MB)

---

## 🧪 Testing

Use the included `test.html` file or tools like Postman to test all endpoints:

```bash
# Start server
npm start

# Access test interface
http://localhost:5000/test.html
```

---

## 🆘 Support

For API issues:
1. Check server logs for detailed error messages
2. Verify Firebase configuration
3. Ensure proper authentication headers
4. Review request payload format

**CloudCollab Backend API** - Complete REST API for team collaboration! 🚀