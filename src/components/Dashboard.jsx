import React, { useState } from 'react'
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
  const [dangerNodes, setDangerNodes] = useState(new Set())
  const [evacuationPath, setEvacuationPath] = useState(null)

  const handleNodeClick = async (nodeId) => {
    try {
      const response = await fetch(`http://localhost:8080/get_path?start_node=${nodeId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch evacuation path')
      }
      const data = await response.json()

      // Update danger nodes - add new live_danger_nodes to the set
      setDangerNodes(prev => {
        const newSet = new Set(prev)
        data.live_danger_nodes.forEach(nodeId => newSet.add(nodeId))
        return newSet
      })

      // Set fire detected if we have danger nodes
      if (data.live_danger_nodes.length > 0) {
        setFireDetected(true)
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

      // Store evacuation path data
      setEvacuationPath({
        path: data.path,
        cost: data.cost,
        startNode: nodeId
      })
    } catch (error) {
      console.error('Error fetching evacuation path:', error)
    }
  }

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
    setDangerNodes(new Set())
    setEvacuationPath(null)
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
            dangerNodes={dangerNodes}
            evacuationPath={evacuationPath}
            onNodeClick={handleNodeClick}
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
      {fireDetected && (
        <button className="clear-alert-btn" onClick={clearAlert}>
          Clear Alert
        </button>
      )}
    </div>
  )
}

export default Dashboard

