import React from 'react'
import CameraFeed from './CameraFeed'
import './SurveillanceGrid.css'

const SurveillanceGrid = ({ fireDetected, activeCamera, fireData }) => {
  const cameras = [
    { id: 'Camera A', label: 'Camera A', location: 'Main Quad' },
    { id: 'Camera B', label: 'Camera B', location: 'Lasuen Walk' },
    { id: 'Camera C', label: 'Camera C', location: 'Hoover Tower Road' },
    { id: 'Camera D', label: 'Camera D', location: 'Campus Drive North' }
  ]

  return (
    <div className="surveillance-grid">
      <div className="surveillance-grid-header">
        <h2>CCTV Monitoring Feeds</h2>
        <span className="system-status">{fireDetected ? '🔴 ALERT' : '🟢 NORMAL'}</span>
      </div>
      <div className="surveillance-grid-container">
        {cameras.map((camera) => (
          <CameraFeed
            key={camera.id}
            camera={camera}
            isFireDetected={fireDetected && activeCamera === camera.id}
            fireData={fireDetected && activeCamera === camera.id ? fireData : null}
            shouldDesaturate={fireDetected && activeCamera !== camera.id}
          />
        ))}
      </div>
    </div>
  )
}

export default SurveillanceGrid

