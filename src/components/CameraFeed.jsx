import React, { useState, useEffect } from 'react'
import './CameraFeed.css'

const CameraFeed = ({ camera, isFireDetected, fireData, shouldDesaturate }) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Try to load video from videos folder
  // Video files should be in public/videos/ or videos/ folder
  // Expected files: a.mp4, b.mp4, c.mp4, d.mp4
  const cameraLetter = camera.id.replace('Camera ', '').toLowerCase()
  const videoPath = `/videos/${cameraLetter}.mp4`

  return (
    <div 
      className={`camera-feed ${isFireDetected ? 'fire-detected' : ''} ${shouldDesaturate ? 'desaturated' : ''}`}
    >
      <video
        className="camera-video"
        autoPlay
        loop
        muted
        playsInline
        onError={(e) => {
          // If video fails to load, create a colored placeholder
          e.target.style.display = 'none'
          const placeholder = e.target.parentElement.querySelector('.video-placeholder')
          if (placeholder) placeholder.style.display = 'flex'
        }}
      >
        <source src={videoPath} type="video/mp4" />
      </video>
      <div className="video-placeholder" style={{ display: 'none' }}>
        <div className="placeholder-content">
          <div className="placeholder-icon">📹</div>
          <div className="placeholder-text">{camera.id}</div>
          <div className="placeholder-status">LIVE</div>
        </div>
      </div>
      
      {/* Overlay elements */}
      <div className="camera-overlay">
        <div className="camera-overlay-top">
          <span className="live-badge">LIVE</span>
          <span className="timestamp">{formatTime(currentTime)}</span>
        </div>
        <div className="camera-overlay-bottom">
          <span className="camera-label">{camera.label}</span>
          <span className="camera-location">{camera.location}</span>
        </div>
      </div>

      {/* Fire detection alert */}
      {isFireDetected && fireData && (
        <div className="fire-alert-panel">
          <div className="fire-alert-icon">🔥</div>
          <div className="fire-alert-content">
            <div className="fire-alert-title">Fire Detected</div>
            <div className="fire-alert-detail">Location: {fireData.location}</div>
            <div className="fire-alert-detail">Confidence: {fireData.confidence}%</div>
            <div className="fire-alert-detail">Time: {fireData.time}</div>
          </div>
        </div>
      )}

      {/* CRT effect overlay */}
      <div className="crt-overlay"></div>
    </div>
  )
}

export default CameraFeed

