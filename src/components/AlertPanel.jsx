import React from 'react'
import './AlertPanel.css'

const AlertPanel = ({ fireData, activeCamera }) => {
  if (!fireData) return null

  const safeExits = [
    'Main Quad Gate',
    'Lasuen Walk',
    'Campus Drive North'
  ]

  return (
    <div className="alert-panel">
      <div className="alert-panel-header">
        <span className="alert-icon">🚨</span>
        <span className="alert-title">EMERGENCY ALERT</span>
      </div>
      <div className="alert-panel-content">
        <div className="alert-message">
          Fire detected near {fireData.location}
          <br />
          <span className="alert-subtext">Evacuation initiated for nearby zones.</span>
        </div>
        
        <div className="alert-section">
          <div className="alert-section-title">🧭 Safe Exits:</div>
          <ul className="safe-exits-list">
            {safeExits.map((exit, index) => (
              <li key={index} className="safe-exit-item">
                {exit}
              </li>
            ))}
          </ul>
        </div>

        <div className="alert-metrics">
          <div className="alert-metric">
            <span className="metric-label">👥 Pedestrians Detected:</span>
            <span className="metric-value">14</span>
          </div>
          <div className="alert-metric">
            <span className="metric-label">🔥 Fire Confidence:</span>
            <span className="metric-value">{fireData.confidence}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertPanel

