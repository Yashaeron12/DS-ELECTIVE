# CloudCollab Backend API

A robust backend API for a collaborative project management application built with Node.js, Express.js, and Firebase.

## 🚀 Features

- **User Authentication**: Registration and login with Firebase Auth
- **Task Management**: Complete CRUD operations for tasks
- **Real-time Database**: Firestore integration for data persistence
- **Security**: JWT-based authentication middleware
- **CORS Enabled**: Cross-origin resource sharing support
- **RESTful API**: Clean and intuitive API endpoints

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Firebase Admin SDK** - Authentication and database
- **Firestore** - NoSQL database
- **CORS** - Cross-origin requests
- **dotenv** - Environment variables

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/test-login` - User login

### Tasks
- `GET /api/tasks` - Get user's tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Utility
- `GET /health` - Health check
- `GET /` - API information

## 🚦 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/cloudcollab-backend.git
   cd cloudcollab-backend
