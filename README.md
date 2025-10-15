# RTSP Livestream  Application

A full-stack web application for streaming RTSP video with customizable overlays.

## Features
- 🎥 RTSP to HLS video streaming
- 🎨 Customizable text and image overlays
- ⚙️ Quality selection (Low, Medium, High)
- 📱 Responsive design
- 🔄 Real-time overlay management

## Tech Stack
- **Backend:** Node.js, Express, MongoDB, FFmpeg
- **Frontend:** React
- **Streaming:** RTSP to HLS conversion

## Prerequisites
- Node.js v16+
- MongoDB v5+
- FFmpeg

## Quick Start

### 1. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start MongoDB
```bash
mongod
```

### 3. Start Backend (Terminal 1)
```bash
cd backend
npm start
```

### 4. Start Frontend (Terminal 2)
```bash
cd frontend
npm start
```

### 5. Open Browser
Navigate to `http://localhost:3000`

## Project Structure
```
rtsp-livestream-app/
├── backend/          # Express API server
│   ├── config/       # Database configuration
│   ├── models/       # Mongoose models
│   ├── utils/        # FFmpeg handler
│   └── server.js     # Main server file
└── frontend/         # React application
    ├── src/
    │   ├── services/ # API services
    │   ├── utils/    # Constants & helpers
    │   └── App.js    # Main component
    └── public/       # Static files
```

## API Endpoints

### Overlays
- `POST /api/overlays` - Create overlay
- `GET /api/overlays` - Get all overlays
- `GET /api/overlays/:id` - Get single overlay
- `PUT /api/overlays/:id` - Update overlay
- `DELETE /api/overlays/:id` - Delete overlay

### Streaming
- `POST /api/stream/start` - Start stream
- `POST /api/stream/stop` - Stop stream
- `GET /api/stream/status` - Get stream status

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/rtsp-overlay-app
NODE_ENV=development
HLS_OUTPUT_DIR=./hls
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_HLS_URL=http://localhost:5000/hls
```

## License
MIT
