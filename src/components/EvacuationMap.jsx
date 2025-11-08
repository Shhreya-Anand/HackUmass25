import React, { useEffect, useRef } from 'react'
import './EvacuationMap.css'

const EvacuationMap = ({ fireDetected, activeCamera, fireData }) => {
  const svgRef = useRef(null)

  // Camera positions on the map (normalized coordinates)
  const cameraPositions = {
    'Camera A': { x: 0.3, y: 0.4, label: 'Main Quad' },
    'Camera B': { x: 0.5, y: 0.6, label: 'Lasuen Walk' },
    'Camera C': { x: 0.4, y: 0.3, label: 'Hoover Tower' },
    'Camera D': { x: 0.7, y: 0.5, label: 'Campus Drive' }
  }

  // Safe exit points
  const safeExits = [
    { x: 0.2, y: 0.2, label: 'Main Quad Gate' },
    { x: 0.5, y: 0.9, label: 'Lasuen Walk' },
    { x: 0.9, y: 0.4, label: 'Campus Drive North' }
  ]

  // Generate evacuation routes from fire location to safe exits
  const getEvacuationRoutes = () => {
    if (!fireDetected || !activeCamera) return []
    
    const firePos = cameraPositions[activeCamera]
    if (!firePos) return []

    return safeExits.map(exit => ({
      from: firePos,
      to: exit,
      id: `route-${exit.label}`
    }))
  }

  const routes = getEvacuationRoutes()
  const firePosition = activeCamera ? cameraPositions[activeCamera] : null

  return (
    <div className="evacuation-map-container">
      <div className="evacuation-map-header">
        <h2>Evacuation Map</h2>
        <span className="map-status">{fireDetected ? '🚨 ALERT MODE' : '🟢 NORMAL'}</span>
      </div>
      <div className="evacuation-map">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 800"
          className="map-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="1000" height="800" fill="#0C0F14" />
          
          {/* Roads - simplified Stanford campus layout */}
          <g className="roads">
            {/* Main roads */}
            <path
              d="M 200 200 L 800 200 L 800 600 L 200 600 Z"
              stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
              strokeWidth="3"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M 300 150 L 300 650"
              stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
              strokeWidth="2"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M 500 150 L 500 650"
              stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
              strokeWidth="2"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M 700 150 L 700 650"
              stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
              strokeWidth="2"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M 150 300 L 850 300"
              stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
              strokeWidth="2"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M 150 500 L 850 500"
              stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
              strokeWidth="2"
              fill="none"
              opacity="0.2"
            />
          </g>

          {/* Building outlines */}
          <g className="buildings">
            <rect x="250" y="250" width="100" height="80" fill="#1A1F2E" stroke="#7F8C8D" strokeWidth="1" opacity="0.5" />
            <rect x="400" y="200" width="120" height="100" fill="#1A1F2E" stroke="#7F8C8D" strokeWidth="1" opacity="0.5" />
            <rect x="600" y="350" width="100" height="90" fill="#1A1F2E" stroke="#7F8C8D" strokeWidth="1" opacity="0.5" />
            <circle cx="400" cy="300" r="40" fill="#1A1F2E" stroke="#7F8C8D" strokeWidth="1" opacity="0.5" />
          </g>

          {/* Danger radius (when fire detected) */}
          {fireDetected && firePosition && (
            <circle
              cx={firePosition.x * 1000}
              cy={firePosition.y * 800}
              r="150"
              fill="url(#dangerGradient)"
              opacity="0.3"
              className="danger-radius"
            >
              <animate
                attributeName="r"
                values="150;180;150"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.3;0.2;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* Evacuation routes */}
          {routes.map((route, index) => {
            const routePath = `M ${route.from.x * 1000} ${route.from.y * 800} Q ${(route.from.x + route.to.x) * 500} ${(route.from.y + route.to.y) * 400} ${route.to.x * 1000} ${route.to.y * 800}`
            return (
              <g key={route.id} className="evacuation-route">
                {/* Hidden path for animation - must be defined first */}
                <path
                  id={`${route.id}-path`}
                  d={routePath}
                  fill="none"
                  stroke="none"
                  visibility="hidden"
                />
                {/* Visible route line */}
                <path
                  d={routePath}
                  stroke={fireDetected ? '#34D399' : 'transparent'}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="1000"
                  strokeDashoffset={fireDetected ? 0 : 1000}
                  className="route-line"
                  style={{
                    animation: fireDetected ? 'route-draw 1.2s ease-out forwards' : 'none',
                    animationDelay: `${index * 0.2}s`
                  }}
                />
                {/* Animated pedestrian dots along the route */}
                {fireDetected && (
                  <circle
                    r="4"
                    fill="#34D399"
                    className="pedestrian"
                    opacity="0.8"
                  >
                    <animateMotion
                      dur="3s"
                      repeatCount="indefinite"
                      begin={`${index * 0.5}s`}
                    >
                      <mpath href={`#${route.id}-path`} />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0.8;1;0.8"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            )
          })}

          {/* Camera nodes */}
          {Object.entries(cameraPositions).map(([cameraId, pos]) => {
            const isFireNode = fireDetected && activeCamera === cameraId
            return (
              <g key={cameraId} className={`camera-node ${isFireNode ? 'fire-node' : ''}`}>
                {/* Pulsing halo for fire node */}
                {isFireNode && (
                  <circle
                    cx={pos.x * 1000}
                    cy={pos.y * 800}
                    r="25"
                    fill="none"
                    stroke={fireDetected ? '#FF3B3B' : '#E4E4E4'}
                    strokeWidth="3"
                    opacity="0.6"
                    className="node-halo"
                  >
                    <animate
                      attributeName="r"
                      values="25;35;25"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* Main node */}
                <circle
                  cx={pos.x * 1000}
                  cy={pos.y * 800}
                  r="12"
                  fill={isFireNode ? '#FF3B3B' : '#E4E4E4'}
                  stroke={isFireNode ? '#FF3B3B' : '#7F8C8D'}
                  strokeWidth="2"
                  className="node-dot"
                >
                  {isFireNode && (
                    <animate
                      attributeName="r"
                      values="12;15;12"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
                {/* Node label */}
                <text
                  x={pos.x * 1000}
                  y={pos.y * 800 - 20}
                  fill={isFireNode ? '#FF3B3B' : '#E4E4E4'}
                  fontSize="14"
                  fontWeight="600"
                  textAnchor="middle"
                  className="node-label"
                >
                  {cameraId}
                </text>
                <text
                  x={pos.x * 1000}
                  y={pos.y * 800 - 5}
                  fill="#7F8C8D"
                  fontSize="10"
                  textAnchor="middle"
                  className="node-location"
                >
                  {pos.label}
                </text>
              </g>
            )
          })}

          {/* Safe exit markers */}
          {safeExits.map((exit, index) => (
            <g key={exit.label} className="safe-exit">
              <circle
                cx={exit.x * 1000}
                cy={exit.y * 800}
                r="8"
                fill="#34D399"
                stroke="#34D399"
                strokeWidth="2"
                opacity={fireDetected ? 1 : 0.5}
              />
              <text
                x={exit.x * 1000}
                y={exit.y * 800 - 15}
                fill="#34D399"
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                opacity={fireDetected ? 1 : 0.5}
              >
                {exit.label}
              </text>
            </g>
          ))}

          {/* Gradient definitions */}
          <defs>
            <radialGradient id="dangerGradient">
              <stop offset="0%" stopColor="#FF3B3B" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FF3B3B" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}

export default EvacuationMap

