import React, { useState, useEffect } from 'react'
import SurveillanceGrid from './SurveillanceGrid'
import EvacuationMap from './EvacuationMap'
import Timeline from './Timeline'
import AlertPanel from './AlertPanel'
import './Dashboard.css'

const Dashboard = () => {
  const [fireDetected, setFireDetected] = useState(false)
  const [activeCamera, setActiveCamera] = useState(null)
  const [fireData, setFireData] = useState(null)
  const [systemMode, setSystemMode] = useState('NORMAL')
  const [timelineEvents, setTimelineEvents] = useState([
    { time: '13:24', event: 'Normal monitoring', active: true }
  ])

  // Simulate fire detection after 5 seconds for demo
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerFireDetection('Camera C', {
        location: 'Hoover Tower Road',
        confidence: 97,
        time: '13:26:05'
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const triggerFireDetection = (cameraId, data) => {
    setFireDetected(true)
    setActiveCamera(cameraId)
    setFireData(data)
    setSystemMode('ALERT')
    
    setTimelineEvents([
      { time: '13:24', event: 'Normal monitoring', active: false },
      { time: '13:25', event: 'Heat anomaly detected', active: false },
      { time: '13:26', event: 'Fire confirmed', active: true },
      { time: '13:26', event: 'Evacuation route activated', active: true }
    ])

    // Play alert sound (optional - will fail silently if file doesn't exist)
    try {
      const audio = new Audio('/sounds/alert.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {
        // Audio file not found - this is optional
      })
    } catch (err) {
      // Audio not available - continue without sound
    }
  }

  const clearAlert = () => {
    setFireDetected(false)
    setActiveCamera(null)
    setFireData(null)
    setSystemMode('NORMAL')
    setTimelineEvents([
      { time: '13:24', event: 'Normal monitoring', active: true }
    ])
  }

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <div className="dashboard-left">
          <SurveillanceGrid 
            fireDetected={fireDetected}
            activeCamera={activeCamera}
            fireData={fireData}
          />
        </div>
        <div className="dashboard-right">
          <EvacuationMap 
            fireDetected={fireDetected}
            activeCamera={activeCamera}
            fireData={fireData}
          />
          {fireDetected && (
            <AlertPanel 
              fireData={fireData}
              activeCamera={activeCamera}
            />
          )}
        </div>
      </div>
      <div className="dashboard-bottom">
        <Timeline 
          events={timelineEvents}
          systemMode={systemMode}
          fireDetected={fireDetected}
          activeRoutes={fireDetected ? 2 : 0}
          responseTime={fireDetected ? 1.8 : 0}
        />
      </div>
      {fireDe