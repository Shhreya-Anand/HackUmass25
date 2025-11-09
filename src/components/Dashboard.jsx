import React, { useState, useEffect, useRef, useCallback } from 'react'
import SurveillanceGrid from './SurveillanceGrid'
import EvacuationMap from './EvacuationMap'
import Timeline from './Timeline'
import AlertPanel from './AlertPanel'
import './Dashboard.css'

// Helper to get current time for timeline
const getCurrentTime = () => 
  new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  })

const Dashboard = () => {
  const [fireDetected, setFireDetected] = useState(false)
  const [activeCamera, setActiveCamera] = useState(null)
  const [fireData, setFireData] = useState(null)
  const [systemMode, setSystemMode] = useState('NORMAL')
  const [timelineEvents, setTimelineEvents] = useState([
    { time: getCurrentTime(), event: 'Normal monitoring', active: true }
  ])
  const [dangerNodes, setDangerNodes] = useState(new Set())
  const [evacuationPath, setEvacuationPath] = useState(null)
  const [voiceSessionId, setVoiceSessionId] = useState(null)
  const [voiceAgentActive, setVoiceAgentActive] = useState(false)
  const pollingIntervalRef = useRef(null)

  // Fetch evacuation path from backend
  const fetchEvacuationPath = useCallback(async (nodeId) => {
    try {
      // Build query parameters - include affected_nodes (dangerNodes) if we have them
      const params = new URLSearchParams({ start_node: nodeId })
      
      // *** FIX: Use `dangerNodes` (a Set) instead of undefined `affectedNodes` ***
      if (dangerNodes.size > 0) {
        dangerNodes.forEach(node => params.append('affected_nodes', node))
      }
      
      const response = await fetch(`http://localhost:8080/get_path?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch evacuation path')
      }
      const data = await response.json()
      console.log('Evacuation path data:', data)

      // Update danger nodes - add new live_danger_nodes to the set
      setDangerNodes(prev => {
        const newSet = new Set(prev)
        data.live_danger_nodes.forEach(nodeId => newSet.add(nodeId))
        return newSet
      })

      // Store evacuation path data
      setEvacuationPath({
        path: data.path,
        cost: data.cost,
        startNode: nodeId
      })

      // Update timeline
      setTimelineEvents(prev => [
        ...prev,
        { time: getCurrentTime(), 
          event: `Evacuation path calculated from ${nodeId}`, 
          active: true }
      ])

      return data
    } catch (error) {
      console.error('Error fetching evacuation path:', error)
      return null
    }
  }, [dangerNodes]) // Depends on the current state of dangerNodes

  // Poll for location from voice agent
  const startLocationPolling = useCallback((sessionId) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Poll every 5 seconds for location
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
          
          // Update timeline *before* fetching path
          setTimelineEvents(prev => [
            ...prev,
            { time: getCurrentTime(), 
              event: `Location confirmed: ${data.location}`, 
              active: true }
          ])

          // *** FIX: Fetch evacuation path with the detected location ***
          await fetchEvacuationPath(data.location)
        }
      } catch (error) {
        console.error('Error polling voice location:', error)
        // Stop polling on error to prevent spam
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }, 5000) // Poll every 5 seconds
  }, [fetchEvacuationPath]) // Depends on fetchEvacuationPath

  // Trigger fire alert agent when fire is detected
  const triggerFireAgent = useCallback(async () => {
    try {
      console.log('🔥 Triggering fire alert agent...')
      const response = await fetch('http://localhost:8080/trigger_fire_agent', {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Failed to trigger fire alert agent')
      }
      const data = await response.json()
      console.log('Fire alert agent started:', data)
      
      setVoiceAgentActive(true)

      // *** FIX: Set session ID and start polling ***
      if (data.session_id) {
        setVoiceSessionId(data.session_id)
        startLocationPolling(data.session_id)
      } else {
        console.error('No session_id received from fire agent!')
      }
      
      // Update timeline
      setTimelineEvents(prev => [
        ...prev,
        { time: getCurrentTime(), 
          event: '🔥 Fire alert agent activated - Agent is asking for location', 
          active: true }
      ])
    } catch (error) {
      console.error('Error triggering fire alert agent:', error)
    }
  }, [startLocationPolling]) // Depends on startLocationPolling

  // *** NEW FUNCTION: Centralized logic for triggering the alert ***
  const initiateFireAlert = useCallback((detectedFireData) => {
    console.log('🔥 Fire detected automatically! Danger nodes:', detectedFireData.danger_nodes)

    // Trigger fire detection UI
    setFireDetected(true)
    setSystemMode('ALERT')
    setFireData({
      danger_nodes: detectedFireData.danger_nodes,
      crowd_data: detectedFireData.crowd_data || []
    })
    
    // Update danger nodes
    setDangerNodes(new Set(detectedFireData.danger_nodes))
    
    // Update timeline
    const currentTime = getCurrentTime()
    setTimelineEvents(prev => [
      ...prev,
      { time: currentTime, event: 'Fire detected automatically', active: false },
      { time: currentTime, event: `Danger nodes: ${detectedFireData.danger_nodes.join(', ')}`, active: true }
    ])
    
    // Trigger fire alert agent - agent will ask where you are
    triggerFireAgent()
    
    // Play alert sound
    try {
      const audio = new Audio('/sounds/alert.mp3')
      audio.volume = 0.3
      audio.play().catch(() => {
        // Audio file not found or play interrupted - this is optional
      })
    } catch (err) {
      // Audio not available - continue without sound
    }
  }, [triggerFireAgent]) // Depends on triggerFireAgent

  // Handle manual node click (fallback)
  const handleNodeClick = useCallback(async (nodeId) => {
    await fetchEvacuationPath(nodeId)
  }, [fetchEvacuationPath]) // Depends on fetchEvacuationPath

  // Auto-detect fire from backend world state
  useEffect(() => {
    const checkFireDetection = async () => {
      try {
        const response = await fetch('http://localhost:8080/get_world_state')
        if (!response.ok) {
          throw new Error('Failed to fetch world state')
        }
        const data = await response.json()
        
        // If fire is detected and wasn't detected before, trigger fire detection
        if (data.has_fire && data.danger_nodes && data.danger_nodes.length > 0 && !fireDetected) {
          // *** FIX: Call the centralized alert function ***
          initiateFireAlert(data)
        }
        
        // If fire is cleared (no danger nodes), clear the alert
        if (!data.has_fire && fireDetected && (!data.danger_nodes || data.danger_nodes.length === 0)) {
          console.log('Fire cleared - no danger nodes detected')
          clearAlert()
        }
      } catch (error) {
        console.error('Error checking fire detection:', error)
      }
    }
    
    // Poll backend for danger nodes every 5 seconds
    const interval = setInterval(checkFireDetection, 9000)
    // Initial check
    checkFireDetection()
    return () => clearInterval(interval)
  }, [fireDetected, initiateFireAlert]) // Depends on fireDetected and the alert function

  // Clear alert and reset state
  const clearAlert = useCallback(() => {
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
      { time: getCurrentTime(), event: 'Normal monitoring', active: true }
    ])
  }, []) // No dependencies needed

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, []) // Empty dependency array, runs only on mount/unmount

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <div className="dashboard-left">
          <SurveillanceGrid
            fireDetected={fireDetected}
            activeCamera={activeCamera}
            fireData={fireData}
            // Pass initiateFireAlert as a prop if cameras can manually trigger it
            // onManualFireDetect={initiateFireAlert} 
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
          activeRoutes={fireDetected ? 2 : 0} // This is still hardcoded, but that's from the original
          responseTime={fireDetected ? 1.8 : 0} // This is still hardcoded, but that's from the original
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