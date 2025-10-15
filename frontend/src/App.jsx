


// App.js with HLS.js support
import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000/api';
const HLS_URL = 'http://localhost:5000/hls/stream.m3u8';

function App() {
  const [overlays, setOverlays] = useState([]);
  const [, setStreamSettings] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rtspUrl, setRtspUrl] = useState('');
  const [quality, setQuality] = useState('medium');
  const [showOverlayForm, setShowOverlayForm] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState(null);
  const [streamStatus, setStreamStatus] = useState('');
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [newOverlay, setNewOverlay] = useState({
    name: '',
    type: 'text',
    content: '',
    position: { x: 50, y: 50 },
    size: { width: 200, height: 50 },
    style: {
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      opacity: 1
    }
  });

  // Fetch overlays
  const fetchOverlays = async () => {
    try {
      const res = await fetch(`${API_URL}/overlays`);
      const data = await res.json();
      if (data.success) {
        setOverlays(data.data);
      }
    } catch (error) {
      console.error('Error fetching overlays:', error);
    }
  };

  // Fetch stream status
  const fetchStreamStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/stream/status`);
      const data = await res.json();
      if (data.success) {
        setIsStreaming(data.data.isStreaming);
        setStreamSettings(data.data.settings);
        if (data.data.settings) {
          setRtspUrl(data.data.settings.rtspUrl);
          setQuality(data.data.settings.quality);
        }
      }
    } catch (error) {
      console.error('Error fetching stream status:', error);
    }
  };

  useEffect(() => {
    fetchOverlays();
    fetchStreamStatus();
  }, []);

  // Initialize HLS player
  const initializeHLS = () => {
    if (!videoRef.current) return;

    // Dynamically load HLS.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.async = true;
    script.onload = () => {
      console.log('HLS.js loaded successfully');
      loadHLSStream();
    };
    document.body.appendChild(script);
  };

  const loadHLSStream = () => {
    if (!window.Hls) {
      console.error('HLS.js not loaded');
      setError('HLS player library not loaded. Please refresh the page.');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Check if HLS is supported
    if (window.Hls.isSupported()) {
      console.log('HLS.js is supported, initializing...');
      
      // Destroy existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new window.Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hlsRef.current = hls;

      hls.loadSource(HLS_URL);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded, trying to play...');
        setStreamStatus('Stream ready, starting playback...');
        setError('');
        
        video.play().then(() => {
          console.log('Video playback started successfully');
          setStreamStatus('Streaming live');
        }).catch(err => {
          console.error('Playback error:', err);
          setStreamStatus('Click play button to start');
        });
      });

      hls.on(window.Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error - trying to recover...');
              setError('Network error. Retrying...');
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error - trying to recover...');
              setError('Media error. Retrying...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error - destroying HLS instance');
              setError('Fatal streaming error. Please restart the stream.');
              hls.destroy();
              break;
          }
        }
      });

      hls.on(window.Hls.Events.FRAG_LOADED, () => {
        if (error) setError('');
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari native HLS support
      console.log('Using native HLS support');
      video.src = HLS_URL;
      video.addEventListener('loadedmetadata', () => {
        video.play();
      });
    } else {
      setError('HLS is not supported in your browser. Please use Chrome, Firefox, or Safari.');
    }
  };

  // Start streaming
  const handleStartStream = async () => {
    if (!rtspUrl) {
      setError('Please enter an RTSP URL');
      return;
    }

    setError('');
    setStreamStatus('Starting stream...');

    try {
      const res = await fetch(`${API_URL}/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtspUrl, quality })
      });
      const data = await res.json();
      
      if (data.success) {
        setIsStreaming(true);
        setStreamStatus('Stream starting... Please wait 5-10 seconds');
        
        // Wait for HLS segments to be generated
        setTimeout(() => {
          setStreamStatus('Loading video player...');
          initializeHLS();
        }, 5000);

        // Check stream status every 2 seconds
        const checkInterval = setInterval(async () => {
          const statusRes = await fetch(`${API_URL}/stream/status`);
          const statusData = await statusRes.json();
          if (statusData.success && statusData.data.hasHLSFiles) {
            setStreamStatus('Stream ready!');
            clearInterval(checkInterval);
          }
        }, 2000);

        // Clear interval after 30 seconds
        setTimeout(() => clearInterval(checkInterval), 30000);
      } else {
        setError('Failed to start stream: ' + (data.error || 'Unknown error'));
        setStreamStatus('');
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      setError('Failed to start stream. Please check your connection.');
      setStreamStatus('');
    }
  };

  // Stop streaming
  const handleStopStream = async () => {
    try {
      // Destroy HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Pause video
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }

      const res = await fetch(`${API_URL}/stream/stop`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        setIsStreaming(false);
        setStreamStatus('');
        setError('');
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  // Create overlay
  const handleCreateOverlay = async () => {
    try {
      const res = await fetch(`${API_URL}/overlays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOverlay)
      });
      const data = await res.json();
      
      if (data.success) {
        fetchOverlays();
        setShowOverlayForm(false);
        resetOverlayForm();
      }
    } catch (error) {
      console.error('Error creating overlay:', error);
    }
  };

  // Update overlay
  const handleUpdateOverlay = async () => {
    try {
      const res = await fetch(`${API_URL}/overlays/${editingOverlay._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOverlay)
      });
      const data = await res.json();
      
      if (data.success) {
        fetchOverlays();
        setEditingOverlay(null);
        setShowOverlayForm(false);
        resetOverlayForm();
      }
    } catch (error) {
      console.error('Error updating overlay:', error);
    }
  };

  // Delete overlay
  const handleDeleteOverlay = async (id) => {
    if (!window.confirm('Are you sure you want to delete this overlay?')) return;
    
    try {
      const res = await fetch(`${API_URL}/overlays/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        fetchOverlays();
      }
    } catch (error) {
      console.error('Error deleting overlay:', error);
    }
  };

  // Toggle overlay active state
  const toggleOverlayActive = async (overlay) => {
    try {
      const res = await fetch(`${API_URL}/overlays/${overlay._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...overlay, isActive: !overlay.isActive })
      });
      const data = await res.json();
      
      if (data.success) {
        fetchOverlays();
      }
    } catch (error) {
      console.error('Error toggling overlay:', error);
    }
  };

  const resetOverlayForm = () => {
    setNewOverlay({
      name: '',
      type: 'text',
      content: '',
      position: { x: 50, y: 50 },
      size: { width: 200, height: 50 },
      style: {
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        opacity: 1
      }
    });
  };

  const startEditing = (overlay) => {
    setEditingOverlay(overlay);
    setNewOverlay(overlay);
    setShowOverlayForm(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="header">
        <h1>🎥 RTSP Livestream</h1>
      </header>

      <div className="container">
        <div className="video-section">
          <div className="video-container">
            {isStreaming ? (
              <div className="video-wrapper">
                <video
                  ref={videoRef}
                  className="video-player"
                  controls
                  autoPlay
                  muted
                  playsInline
                />
                
                {/* Stream Status */}
                {streamStatus && (
                  <div className="stream-status">
                    {streamStatus}
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="stream-error">
                    ⚠️ {error}
                  </div>
                )}
                
                {/* Render Active Overlays */}
                {overlays.filter(o => o.isActive).map(overlay => (
                  <div
                    key={overlay._id}
                    className="overlay-item"
                    style={{
                      position: 'absolute',
                      left: `${overlay.position.x}px`,
                      top: `${overlay.position.y}px`,
                      width: `${overlay.size.width}px`,
                      height: overlay.type === 'text' ? 'auto' : `${overlay.size.height}px`,
                      fontSize: `${overlay.style.fontSize}px`,
                      color: overlay.style.color,
                      backgroundColor: overlay.style.backgroundColor,
                      opacity: overlay.style.opacity,
                      padding: overlay.type === 'text' ? '8px 12px' : '0',
                      borderRadius: '4px',
                      pointerEvents: 'none',
                      zIndex: 10
                    }}
                  >
                    {overlay.type === 'text' ? (
                      overlay.content
                    ) : (
                      <img 
                        src={overlay.content} 
                        alt={overlay.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder">
                <div className="placeholder-content">
                  <p>📹 Enter RTSP URL below and click Start Stream</p>
                  <p className="placeholder-hint">Try: rtsp://8.devline.ru:9784/cameras/18/streaming/sub?authorization=Basic%20YWRtaW46&audio=0</p>
                </div>
              </div>
            )}
          </div>

          {/* Stream Controls */}
          <div className="stream-controls">
            <input
              type="text"
              className="input input-url"
              placeholder="Enter RTSP URL (e.g., rtsp://...)"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              disabled={isStreaming}
            />
            <select 
              className="select"
              value={quality} 
              onChange={(e) => setQuality(e.target.value)}
              disabled={isStreaming}
            >
              <option value="low">Low Quality (640x360)</option>
              <option value="medium">Medium Quality (1280x720)</option>
              <option value="high">High Quality (1920x1080)</option>
            </select>
            {!isStreaming ? (
              <button className="btn btn-primary" onClick={handleStartStream}>
                ▶️ Start Stream
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handleStopStream}>
                ⏹️ Stop Stream
              </button>
            )}
          </div>

          {/* Tips */}
          {!isStreaming && (
            <div className="tips">
              <p><strong>💡 Tips:</strong></p>
              <ul>
                <li>Use the provided test URL for quick testing</li>
                <li>Wait 5-10 seconds after clicking Start Stream</li>
                <li>Check backend console for streaming progress</li>
              </ul>
            </div>
          )}
        </div>

        {/* Overlay Management Section */}
        <div className="overlay-section">
          <div className="section-header">
            <h2>Overlay Management</h2>
            <button 
              className="btn btn-success"
              onClick={() => {
                setShowOverlayForm(!showOverlayForm);
                setEditingOverlay(null);
                resetOverlayForm();
              }}
            >
              {showOverlayForm ? 'Cancel' : '+ Add Overlay'}
            </button>
          </div>

          {/* Overlay Form */}
          {showOverlayForm && (
            <div className="overlay-form">
              <h3>{editingOverlay ? 'Edit Overlay' : 'Create New Overlay'}</h3>
              
              <input
                type="text"
                className="input"
                placeholder="Overlay Name"
                value={newOverlay.name}
                onChange={(e) => setNewOverlay({...newOverlay, name: e.target.value})}
              />

              <select 
                className="select"
                value={newOverlay.type}
                onChange={(e) => setNewOverlay({...newOverlay, type: e.target.value})}
              >
                <option value="text">Text</option>
                <option value="logo">Logo/Image</option>
              </select>

              {newOverlay.type === 'text' ? (
                <input
                  type="text"
                  className="input"
                  placeholder="Text Content"
                  value={newOverlay.content}
                  onChange={(e) => setNewOverlay({...newOverlay, content: e.target.value})}
                />
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="Image URL"
                  value={newOverlay.content}
                  onChange={(e) => setNewOverlay({...newOverlay, content: e.target.value})}
                />
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Position X:</label>
                  <input
                    type="number"
                    className="input"
                    value={newOverlay.position.x}
                    onChange={(e) => setNewOverlay({
                      ...newOverlay, 
                      position: {...newOverlay.position, x: parseInt(e.target.value)}
                    })}
                  />
                </div>
                <div className="form-group">
                  <label>Position Y:</label>
                  <input
                    type="number"
                    className="input"
                    value={newOverlay.position.y}
                    onChange={(e) => setNewOverlay({
                      ...newOverlay, 
                      position: {...newOverlay.position, y: parseInt(e.target.value)}
                    })}
                  />
                </div>
              </div>

              <button 
                className="btn btn-primary"
                onClick={editingOverlay ? handleUpdateOverlay : handleCreateOverlay}
              >
                {editingOverlay ? 'Update Overlay' : 'Create Overlay'}
              </button>
            </div>
          )}

          {/* Overlay List */}
          <div className="overlay-list">
            <h3>Saved Overlays ({overlays.length})</h3>
            {overlays.map(overlay => (
              <div key={overlay._id} className="overlay-card">
                <div className="overlay-info">
                  <h4>{overlay.name}</h4>
                  <p><strong>Type:</strong> {overlay.type}</p>
                  <p><strong>Content:</strong> {overlay.content.substring(0, 50)}</p>
                </div>
                <div className="overlay-actions">
                  <button 
                    className={`btn btn-sm ${overlay.isActive ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => toggleOverlayActive(overlay)}
                  >
                    {overlay.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button 
                    className="btn btn-sm btn-info"
                    onClick={() => startEditing(overlay)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteOverlay(overlay._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {overlays.length === 0 && (
              <p className="empty-state">No overlays created yet. Click "Add Overlay" to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;