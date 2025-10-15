


const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

class FFmpegHandler {
  constructor() {
    this.activeStream = null;
    this.isStreamRunning = false;
    this.streamStartTime = null;
  }

  startStream(rtspUrl, quality = 'medium') {
    // Stop existing stream
    if (this.activeStream) {
      try {
        console.log('Stopping existing stream...');
        this.activeStream.kill('SIGTERM');
        this.activeStream = null;
      } catch (err) {
        console.error('Error stopping previous stream:', err.message);
      }
    }

    // Create HLS directory
    const hlsDir = path.join(__dirname, '../hls');
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
      console.log('Created HLS directory:', hlsDir);
    }

    // Clean up old segments
    try {
      const files = fs.readdirSync(hlsDir);
      files.forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.m3u8')) {
          fs.unlinkSync(path.join(hlsDir, file));
        }
      });
      console.log('Cleaned up old HLS files');
    } catch (err) {
      console.log('No old files to clean up');
    }

    // Quality settings - adjusted for better compatibility
    const qualitySettings = {
      low: { 
        videoBitrate: '500k', 
        audioBitrate: '64k', 
        width: 640, 
        height: 360,
        fps: 24
      },
      medium: { 
        videoBitrate: '1000k', 
        audioBitrate: '96k', 
        width: 1280, 
        height: 720,
        fps: 30
      },
      high: { 
        videoBitrate: '2000k', 
        audioBitrate: '128k', 
        width: 1920, 
        height: 1080,
        fps: 30
      }
    };

    const settings = qualitySettings[quality];
    const outputPath = path.join(hlsDir, 'stream.m3u8');

    console.log('\n' + '='.repeat(60));
    console.log('Starting FFmpeg Stream');
    console.log('='.repeat(60));
    console.log('RTSP URL:', rtspUrl);
    console.log('Quality:', quality);
    console.log('Output Path:', outputPath);
    console.log('Settings:', JSON.stringify(settings, null, 2));
    console.log('='.repeat(60) + '\n');

    this.streamStartTime = Date.now();

    this.activeStream = ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '3000000',
        '-probesize', '3000000',
        '-max_delay', '500000'
      ])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-profile:v', 'baseline',
        '-level', '3.0',
        '-b:v', settings.videoBitrate,
        '-maxrate', settings.videoBitrate,
        '-bufsize', '1M',
        '-g', '60',
        '-keyint_min', '30',
        '-sc_threshold', '0',
        '-r', settings.fps.toString(),
        '-vf', `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease,pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2`,
        '-b:a', settings.audioBitrate,
        '-ar', '44100',
        '-ac', '2',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '3',
        '-hls_flags', 'delete_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', path.join(hlsDir, 'segment%03d.ts'),
        '-start_number', '0'
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('✓ FFmpeg process started successfully');
        console.log('\nCommand:', cmd);
        console.log('\n' + '-'.repeat(60));
        this.isStreamRunning = true;
      })
      .on('codecData', (data) => {
        console.log('\n📊 Stream Information:');
        console.log('   Format:', data.format);
        console.log('   Duration:', data.duration);
        console.log('   Video:', data.video);
        console.log('   Audio:', data.audio);
        console.log('-'.repeat(60) + '\n');
      })
      .on('progress', (progress) => {
        if (progress.frames && progress.frames % 30 === 0) {
          const elapsed = ((Date.now() - this.streamStartTime) / 1000).toFixed(1);
          console.log(`📡 Streaming: ${progress.frames} frames | ${progress.currentFps} fps | ${progress.timemark} | ${elapsed}s elapsed`);
        }
      })
      .on('stderr', (stderrLine) => {
        // Only log important error lines
        if (stderrLine.includes('error') || 
            stderrLine.includes('Error') || 
            stderrLine.includes('failed') ||
            stderrLine.includes('Invalid')) {
          console.error('⚠ FFmpeg stderr:', stderrLine);
        }
      })
      .on('error', (err, stdout, stderr) => {
        console.error('\n' + '='.repeat(60));
        console.error('❌ FFmpeg Error Occurred');
        console.error('='.repeat(60));
        console.error('Error:', err.message);
        
        if (err.message.includes('SIGKILL')) {
          console.error('\n🔴 Stream was forcefully killed');
          console.error('Possible reasons:');
          console.error('  - Insufficient system resources');
          console.error('  - Antivirus/Firewall blocking');
          console.error('  - FFmpeg process limit reached');
        } else if (err.message.includes('RTSP') || err.message.includes('Connection')) {
          console.error('\n🔴 RTSP Connection Issue');
          console.error('Possible reasons:');
          console.error('  - Invalid RTSP URL');
          console.error('  - Network connectivity problem');
          console.error('  - RTSP server not accessible');
          console.error('  - Firewall blocking port 554');
        } else if (err.message.includes('timeout')) {
          console.error('\n🔴 Connection Timeout');
          console.error('  - RTSP server not responding');
          console.error('  - Network latency too high');
        } else if (err.message.includes('Unrecognized option')) {
          console.error('\n🔴 FFmpeg Option Error');
          console.error('  - Your FFmpeg version may not support some options');
          console.error('  - Consider updating FFmpeg');
        }
        
        if (stderr) {
          console.error('\nLast FFmpeg output:');
          console.error(stderr.split('\n').slice(-10).join('\n'));
        }
        console.error('='.repeat(60) + '\n');
        
        this.activeStream = null;
        this.isStreamRunning = false;
      })
      .on('end', () => {
        console.log('\n' + '='.repeat(60));
        console.log('⏹ FFmpeg process ended normally');
        console.log('='.repeat(60) + '\n');
        this.activeStream = null;
        this.isStreamRunning = false;
      });

    try {
      this.activeStream.run();
      console.log('FFmpeg run() called - waiting for stream initialization...\n');
      return true;
    } catch (err) {
      console.error('❌ Failed to start FFmpeg:', err.message);
      this.activeStream = null;
      this.isStreamRunning = false;
      throw err;
    }
  }

  stopStream() {
    if (this.activeStream) {
      try {
        console.log('\n⏹ Stopping FFmpeg stream...');
        this.activeStream.kill('SIGTERM');
        
        // Give it a moment, then force kill if needed
        setTimeout(() => {
          if (this.activeStream) {
            console.log('Force killing FFmpeg...');
            this.activeStream.kill('SIGKILL');
          }
        }, 2000);
        
        this.activeStream = null;
        this.isStreamRunning = false;
        console.log('✓ Stream stopped successfully\n');
        return true;
      } catch (err) {
        console.error('Error stopping stream:', err.message);
        this.activeStream = null;
        this.isStreamRunning = false;
        return false;
      }
    }
    console.log('No active stream to stop');
    return false;
  }

  isStreaming() {
    return this.activeStream !== null && this.isStreamRunning;
  }

  getStreamInfo() {
    return {
      isStreaming: this.isStreaming(),
      uptime: this.streamStartTime ? Math.floor((Date.now() - this.streamStartTime) / 1000) : 0
    };
  }

  // Test RTSP connection before starting stream
  async testRTSPConnection(rtspUrl) {
    return new Promise((resolve, reject) => {
      console.log('\n🧪 Testing RTSP Connection...');
      console.log('URL:', rtspUrl);
      
      const testProcess = ffmpeg(rtspUrl)
        .inputOptions([
          '-rtsp_transport', 'tcp',
          '-analyzeduration', '2000000',
          '-probesize', '2000000'
        ])
        .outputOptions([
          '-t', '2',
          '-f', 'null'
        ])
        .output('-')
        .on('start', (cmd) => {
          console.log('Test command:', cmd);
        })
        .on('progress', (progress) => {
          console.log('Test progress:', progress.timemark);
        })
        .on('end', () => {
          console.log('✓ RTSP connection test PASSED\n');
          resolve(true);
        })
        .on('error', (err) => {
          console.error('❌ RTSP connection test FAILED');
          console.error('Error:', err.message);
          reject(err);
        });

      try {
        testProcess.run();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new FFmpegHandler();