import React, { useState, useEffect, useRef } from 'react'
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
  const [voiceSessionId, setVoiceSessionId] = useState(null)
  const [voiceAgentActive, setVoiceAgentActive] = useState(false)
  const pollingIntervalRef = useRef(null)
  const audioRef = useRef(null)

  // Generate and play alert audio using Eleven Labs
  const generateAndPlayAlertAudio = async (dangerNodes, escapePath, startNode = null) => {
    try {
      console.log('Generating alert audio...', { dangerNodes, escapePath, startNode })
      
      // Convert Set to Array if needed
      const dangerNodesArray = Array.isArray(dangerNodes) ? dangerNodes : Array.from(dangerNodes)
      const escapePathArray = Array.isArray(escapePath) ? escapePath : escapePath
      
      // Call the audio generation endpoint
      const response = await fetch('http://localhost:8080/generate_alert_audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          danger_nodes: dangerNodesArray,
          escape_path: escapePathArray,
          start_node: startNode
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate alert audio')
      }
      
      // Get audio blob
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Create audio element and play
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      
      // Play audio
      audio.play().catch(error => {
        console.error('Error playing audio:', error)
      })
      
      // Clean up URL when audio ends
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl)
      })
      
      console.log('Alert audio playing...')
      
      // Update timeline
      setTimelineEvents(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
          event: 'Emergency alert audio playing', 
          active: true }
      ])
      
    } catch (error) {
      console.error('Error generating alert audio:', error)
    }
  }

  // Fetch evacuation path from backend
  const fetchEvacuationPath = async (nodeId) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({ start_node: nodeId })
      
      const response = await fetch(`http://localhost:8080/get_path?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch evacuation path')
      }
      const data = await response.json()
      console.log('Evacuation path data:', data)

      // Update danger nodes - add new live_danger_nodes to the set
      const updatedDangerNodes = new Set()
      data.live_danger_nodes.forEach(nodeId => updatedDangerNodes.add(nodeId))
      setDangerNodes(updatedDangerNodes)

      // Store evacuation path data
      setEvacuationPath({
        path: data.path,
        cost: data.cost,
        startNode: nodeId
      })

      // Generate and play alert audio with danger nodes and escape path
      if (data.path && data.path.length > 0) {
        await generateAndPlayAlertAudio(
          data.live_danger_nodes || [],
          data.path,
          nodeId
        )
      }

      // Update timeline
      setTimelineEvents(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
          event: `Evacuation path calculated from ${nodeId}`, 
          active: true }
      ])

      return data
    } catch (error) {
      console.error('Error fetching evacuation path:', error)
      return null
    }
  }

  // Handle manual node click (fallback)
  const handleNodeClick = async (nodeId) => {
    await fetchEvacuationPath(nodeId)
  }

  // Trigger voice agent when fire is detected
  const triggerVoiceAgent = async () => {
    try {
      console.log('Triggering voice agent...')
      const response = await fetch('http://localhost:8080/trigger_voice_alert')
      if (!response.ok) {
        throw new Error('Failed to trigger voice agent')
      }
      const data = await response.json()
      console.log('Voice agent started:', data)
      
      setVoiceSessionId(data.session_id)
      setVoiceAgentActive(true)
      
      // Start polling for location
      startLocationPolling(data.session_id)
      
      // Update timeline
      setTimelineEvents(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
          event: 'Voice agent activated - Please state your location', 
          active: true }
      ])
    } catch (error) {
      console.error('Error triggering voice agent:', error)
    }
  }

  // Poll for location from voice agent
  const startLocationPolling = (sessionId) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Poll every 1 second for location
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8080/get_voice_location/${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to get voice location')
        }
        const data = await response.json()
        console.log('Voice agent status:', data)

        // If location is detected, fetch the path
        if (data.location && !data.is_active) {
          console.log('Location detected from voice agent:', data.location)
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          
          setVoiceAgentActive(false)
          
          // Fetch evacuation path with the detected location
          const pathData = await fetchEvacuationPath(data.location)
          
          // Audio will be generated automatically in fetchEvacuationPath
          
          // Update timeline
          setTimelineEvents(prev => [
            ...prev,
            { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
              event: `Location confirmed: ${data.location}`, 
              active: true }
          ])
        }
      } catch (error) {
        console.error('Error polling voice location:', error)
      }
    }, 1000) // Poll every 1 second
  }

  // Cleanup polling and audio on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
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
      { time: '13:26', event: 'Voice agent activating...', active: true }
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

    // Trigger voice agent to ask for location
    triggerVoiceAgent()
  }

  // Check for fire detection from backend (danger nodes)
  useEffect(() => {
    const checkFireDetection = async () => {
      // Check if we have danger nodes from backend
      // This would typically come from your backend's current world state
      // For now, we'll rely on manual fire detection or node clicks
    }
    
    // Poll backend for danger nodes every 5 seconds
    const interval = setInterval(checkFireDetection, 5000)
    return () => clearInterval(interval)
  }, [])

  const clearAlert = () => {
    setFireDetected(false)
    setActiveCamera(null)
    setFireData(null)
    setSystemMode('NORMAL')
    setDangerNodes(new Set())
    setEvacuationPath(null)
    setVoiceSessionId(null)
    setVoiceAgentActive(false)
    
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
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
              voiceAgentActive={voiceAgentActive}
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

