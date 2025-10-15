

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Overlay = require('./models/Overlay');
const StreamSettings = require('./models/StreamSettings');
const ffmpegHandler = require('./utils/ffmpegHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/hls', express.static(path.join(__dirname, 'hls')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rtsp-overlay-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    streaming: ffmpegHandler.isStreaming()
  });
});

// ===== OVERLAY CRUD OPERATIONS =====

// CREATE Overlay
app.post('/api/overlays', async (req, res) => {
  try {
    const overlay = new Overlay(req.body);
    await overlay.save();
    res.status(201).json({ success: true, data: overlay });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// READ All Overlays
app.get('/api/overlays', async (req, res) => {
  try {
    const overlays = await Overlay.find().sort({ createdAt: -1 });
    res.json({ success: true, data: overlays });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// READ Single Overlay
app.get('/api/overlays/:id', async (req, res) => {
  try {
    const overlay = await Overlay.findById(req.params.id);
    if (!overlay) {
      return res.status(404).json({ success: false, error: 'Overlay not found' });
    }
    res.json({ success: true, data: overlay });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE Overlay
app.put('/api/overlays/:id', async (req, res) => {
  try {
    req.body.updatedAt = Date.now();
    const overlay = await Overlay.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!overlay) {
      return res.status(404).json({ success: false, error: 'Overlay not found' });
    }
    res.json({ success: true, data: overlay });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE Overlay
app.delete('/api/overlays/:id', async (req, res) => {
  try {
    const overlay = await Overlay.findByIdAndDelete(req.params.id);
    if (!overlay) {
      return res.status(404).json({ success: false, error: 'Overlay not found' });
    }
    res.json({ success: true, message: 'Overlay deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== STREAM MANAGEMENT =====

// TEST RTSP Connection
app.post('/api/stream/test', async (req, res) => {
  try {
    const { rtspUrl } = req.body;
    
    if (!rtspUrl) {
      return res.status(400).json({ success: false, error: 'RTSP URL is required' });
    }

    console.log('Testing RTSP URL:', rtspUrl);
    
    // Test the connection
    await ffmpegHandler.testRTSPConnection(rtspUrl);
    
    res.json({ 
      success: true, 
      message: 'RTSP URL is valid and accessible'
    });
  } catch (error) {
    console.error('RTSP test failed:', error.message);
    res.status(400).json({ 
      success: false, 
      error: 'RTSP URL test failed: ' + error.message,
      suggestion: 'Please check: 1) URL format is correct, 2) Network connection, 3) RTSP server is accessible, 4) Firewall settings'
    });
  }
});

// START Stream
app.post('/api/stream/start', async (req, res) => {
  try {
    const { rtspUrl, quality } = req.body;
    
    if (!rtspUrl) {
      return res.status(400).json({ success: false, error: 'RTSP URL is required' });
    }

    console.log('Starting stream with URL:', rtspUrl);
    console.log('Quality:', quality || 'medium');

    // Check if already streaming
    if (ffmpegHandler.isStreaming()) {
      console.log('Stopping existing stream first...');
      ffmpegHandler.stopStream();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      // Start the stream
      ffmpegHandler.startStream(rtspUrl, quality || 'medium');

      // Update settings
      let settings = await StreamSettings.findOne();
      if (settings) {
        settings.isActive = true;
        settings.rtspUrl = rtspUrl;
        settings.quality = quality || 'medium';
        settings.updatedAt = Date.now();
      } else {
        settings = new StreamSettings({ 
          rtspUrl, 
          quality: quality || 'medium', 
          isActive: true 
        });
      }
      await settings.save();

      // Wait a bit for stream to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));

      res.json({ 
        success: true, 
        message: 'Stream started successfully. Please wait 3-5 seconds for video to load.',
        hlsUrl: '/hls/stream.m3u8',
        streamInfo: {
          rtspUrl,
          quality: quality || 'medium',
          hlsPlaylistUrl: `http://localhost:${process.env.PORT || 5000}/hls/stream.m3u8`
        }
      });
    } catch (error) {
      console.error('Failed to start stream:', error);
      throw error;
    }
  } catch (error) {
    console.error('Stream start error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start stream: ' + error.message,
      troubleshooting: [
        'Verify RTSP URL is correct',
        'Check if FFmpeg is installed properly',
        'Ensure RTSP server is accessible',
        'Try a different RTSP URL (e.g., rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4)',
        'Check firewall/antivirus settings'
      ]
    });
  }
});

// STOP Stream
app.post('/api/stream/stop', async (req, res) => {
  try {
    console.log('Stopping stream...');
    ffmpegHandler.stopStream();

    const settings = await StreamSettings.findOne();
    if (settings) {
      settings.isActive = false;
      settings.updatedAt = Date.now();
      await settings.save();
    }

    res.json({ success: true, message: 'Stream stopped successfully' });
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Stream Status
app.get('/api/stream/status', async (req, res) => {
  try {
    const settings = await StreamSettings.findOne();
    const isStreaming = ffmpegHandler.isStreaming();
    
    // Check if HLS files exist
    const hlsDir = path.join(__dirname, 'hls');
    let hasHLSFiles = false;
    try {
      const files = require('fs').readdirSync(hlsDir);
      hasHLSFiles = files.some(f => f.endsWith('.m3u8'));
    } catch (err) {
      hasHLSFiles = false;
    }
    
    res.json({ 
      success: true, 
      data: {
        isStreaming,
        hasHLSFiles,
        settings: settings || null,
        hlsUrl: hasHLSFiles ? '/hls/stream.m3u8' : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SAVE Stream Settings
app.post('/api/stream/settings', async (req, res) => {
  try {
    const { rtspUrl, quality } = req.body;
    
    let settings = await StreamSettings.findOne();
    if (settings) {
      settings.rtspUrl = rtspUrl;
      settings.quality = quality || 'medium';
      settings.updatedAt = Date.now();
    } else {
      settings = new StreamSettings({ rtspUrl, quality: quality || 'medium' });
    }
    
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET Stream Settings
app.get('/api/stream/settings', async (req, res) => {
  try {
    const settings = await StreamSettings.findOne();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check HLS files
app.get('/api/debug/hls', (req, res) => {
  try {
    const hlsDir = path.join(__dirname, 'hls');
    const fs = require('fs');
    
    if (!fs.existsSync(hlsDir)) {
      return res.json({ 
        success: false, 
        message: 'HLS directory does not exist',
        path: hlsDir 
      });
    }
    
    const files = fs.readdirSync(hlsDir);
    res.json({ 
      success: true, 
      hlsDirectory: hlsDir,
      files: files,
      hasPlaylist: files.some(f => f.endsWith('.m3u8')),
      hasSegments: files.some(f => f.endsWith('.ts'))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`HLS stream available at http://localhost:${PORT}/hls/stream.m3u8`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Debug HLS: http://localhost:${PORT}/api/debug/hls`);
  console.log('='.repeat(60) + '\n');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  ffmpegHandler.stopStream();
  mongoose.connection.close();
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  ffmpegHandler.stopStream();
  mongoose.connection.close();
  process.exit();
});