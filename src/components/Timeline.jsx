import React from 'react'
import './Timeline.css'

const Timeline = ({ events, systemMode, fireDetected, activeRoutes, responseTime }) => {
  return (
    <div className="timeline-container">
      <div className="timeline-section">
        <div className="timeline-header">
          <span className="timeline-title">Event Timeline</span>
        </div>
        <div className="timeline-scroll">
          <div className="timeline-track">
            {events.map((event, index) => (
              <div
                key={index}
                className={`timeline-event ${event.active ? 'active' : ''}`}
              >
                <div className="timeline-event-time">{event.time}</div>
                <div className="timeline-event-dot">
                  {event.active && <div className="timeline-event-pulse"></div>}
                </div>
                <div className="timeline-event-label">{event.event}</div>
              </div>
            ))}
            {/* Progress line */}
            <div className="timeline-progress">
              <div 
                className="timeline-progress-bar"
                style={{
                  width: `${(events.filter(e => e.active).length / events.length) * 100}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="status-section">
        <div className="status-header">
          <span className="status-title">System Status</span>
        </div>
        <div className="status-metrics">
          <div className="status-metric">
            <span className="status-label">Fire Detected:</span>
            <span className={`status-value ${fireDetected ? 'alert' : 'normal'}`}>
              {fireDetected ? '✅' : '❌'}
            </span>
          </div>
          <div className="status-metric">
            <span className="status-label">Active Routes:</span>
            <span className="status-value">{activeRoutes}</span>
          </div>
          <div className="status-metric">
            <span className="status-label">Response Time:</span>
            <span className="status-value">{responseTime > 0 ? `${responseTime}s` : '—'}</span>
          </div>
          <div className="status-metric">
            <span className="status-label">System Mode:</span>
            <span className={`status-value mode-${systemMode.toLowerCase()}`}>
              {systemMode}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Timeline

