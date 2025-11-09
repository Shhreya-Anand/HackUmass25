import React, { useEffect, useRef } from 'react'
import './EvacuationMap.css'

const EvacuationMap = ({ fireDetected, activeCamera, fireData }) => {
  const svgRef = useRef(null)

  // All nodes with coordinates (image dimensions: 1322x670, viewBox: 1000x800)
  const nodes = [
    { id: 'P1', x: 490, y: 248, adjacent: ['P2', 'P7', 'P29', 'P4'], exit_node: false, name: 'The Oval (road)' },
    { id: 'P2', x: 265, y: 248, adjacent: ['P1', 'P3', 'P28'], exit_node: false, name: 'Lasuen Street (near Anderson Collection)' },
    { id: 'P3', x: 153, y: 248, adjacent: ['P2', 'P13'], exit_node: true, name: 'Lasuen Street (near Bing Concert Hall)' },
    { id: 'P4', x: 469, y: 505, adjacent: ['P5', 'P9'], exit_node: false, name: 'Main Quad (History Corner, Building 40)' },
    { id: 'P5', x: 619, y: 499, adjacent: ['P4', 'P6', 'P8'], exit_node: false, name: 'Main Quad (in front of Memorial Church)' },
    { id: 'P6', x: 745, y: 499, adjacent: ['P5', 'P7', 'P24'], exit_node: false, name: 'Main Quad (Building 60)' },
    { id: 'P7', x: 747, y: 243, adjacent: ['P1', 'P6', 'P14', 'P30'], exit_node: false, name: 'The Oval (road)' },
    { id: 'P8', x: 615, y: 573, adjacent: ['P5', 'P9', 'P25'], exit_node: false, name: 'Main Quad (Southeast Corner)' },
    { id: 'P9', x: 465, y: 572, adjacent: ['P4', 'P8', 'P11', 'P26'], exit_node: false, name: 'Main Quad (Southwest Corner)' },
    { id: 'P10', x: 169, y: 574, adjacent: ['P12', 'P11', 'P27'], exit_node: true, name: 'Lomita Drive (near Cantor Arts Center)' },
    { id: 'P11', x: 358, y: 569, adjacent: ['P9', 'P10'], exit_node: false, name: 'Lomita Mall (near Jen-Hsun Huang Engineering Center)' },
    { id: 'P12', x: 153, y: 504, adjacent: ['P10', 'P13', 'P27'], exit_node: true, name: 'Lomita Drive' },
    { id: 'P13', x: 153, y: 329, adjacent: ['P12'], exit_node: true, name: 'Corner of Lasuen Street and Lomita Drive (near McMurtry Building)' },
    { id: 'P14', x: 960, y: 239, adjacent: ['P7', 'P15', 'P16', 'P31', 'P32'], exit_node: false, name: 'Hoover Tower' },
    { id: 'P15', x: 960, y: 376, adjacent: ['P14', 'P18', 'P20'], exit_node: false, name: 'Hoover Institution (Herbert Hoover Memorial Building)' },
    { id: 'P16', x: 1079, y: 248, adjacent: ['P14', 'P17', 'P20'], exit_node: false, name: 'Serra Street (at Knight Management Center / GSB)' },
    { id: 'P17', x: 1311, y: 246, adjacent: ['P16', 'P21'], exit_node: true, name: 'Serra Street (at Schwab Residential Center)' },
    { id: 'P18', x: 969, y: 505, adjacent: ['P15', 'P19', 'P23'], exit_node: false, name: 'Escondido Mall (near Graduate School of Education)' },
    { id: 'P19', x: 1087, y: 504, adjacent: ['P18', 'P20', 'P21', 'P22'], exit_node: false, name: 'Salvatierra Street (near Faculty Club)' },
    { id: 'P20', x: 1079, y: 370, adjacent: ['P15', 'P16', 'P19'], exit_node: false, name: 'Jane Stanford Way' },
    { id: 'P21', x: 1314, y: 503, adjacent: ['P19', 'P17'], exit_node: true, name: 'Jane Stanford Way (near Bechtel International Center)' },
    { id: 'P22', x: 1091, y: 659, adjacent: ['P19', 'P23'], exit_node: true, name: 'Munger Graduate Residence' },
    { id: 'P23', x: 964, y: 659, adjacent: ['P18', 'P22', 'P24'], exit_node: false, name: 'Corner of Jane Stanford Way and Salvatierra Street' },
    { id: 'P24', x: 756, y: 660, adjacent: ['P6', 'P23', 'P25'], exit_node: false, name: 'Jane Stanford Way (near Stanford Law School)' },
    { id: 'P25', x: 619, y: 664, adjacent: ['P8', 'P24', 'P26'], exit_node: false, name: 'Escondido Mall (near Meyer Green)' },
    { id: 'P26', x: 464, y: 662, adjacent: ['P9', 'P25', 'P27'], exit_node: false, name: 'Escondido Mall (near Meyer Green)' },
    { id: 'P27', x: 170, y: 659, adjacent: ['P10', 'P12', 'P26'], exit_node: true, name: 'Rodin Sculpture Garden' },
    { id: 'P28', x: 267, y: 6, adjacent: ['P29'], exit_node: true, name: 'Campus Drive' },
    { id: 'P29', x: 480, y: 7, adjacent: ['P28', 'P1', 'P30'], exit_node: true, name: 'Palm Drive' },
    { id: 'P30', x: 745, y: 6, adjacent: ['P29', 'P7', 'P31'], exit_node: true, name: 'Palm Drive' },
    { id: 'P31', x: 964, y: 3, adjacent: ['P30', 'P14', 'P32'], exit_node: true, name: 'Corner of Palm Drive and Arboretum Road' },
    { id: 'P32', x: 956, y: 112, adjacent: ['P31', 'P14'], exit_node: false, name: 'Galvez Street' }
  ]

  // Normalize coordinates from image dimensions (1322x670) to viewBox (1000x800)
  // x: 0-1322 -> 0-1000, y: 0-670 -> 0-800
  const normalizeX = (x) => (x / 1322) * 1000
  const normalizeY = (y) => (y / 670) * 800

  // Create node lookup map
  const nodeMap = new Map(nodes.map(node => [node.id, node]))

  // Camera positions (only 4 cameras: A->P1, B->P2, C->P3, D->P4)
  const cameraNodeMap = {
    'Camera A': 'P1',
    'Camera B': 'P2',
    'Camera C': 'P3',
    'Camera D': 'P4'
  }

  const cameraPositions = {
    'Camera A': { x: normalizeX(490), y: normalizeY(248), label: 'P1', name: nodes.find(n => n.id === 'P1')?.name || '' },
    'Camera B': { x: normalizeX(265), y: normalizeY(248), label: 'P2', name: nodes.find(n => n.id === 'P2')?.name || '' },
    'Camera C': { x: normalizeX(153), y: normalizeY(248), label: 'P3', name: nodes.find(n => n.id === 'P3')?.name || '' },
    'Camera D': { x: normalizeX(469), y: normalizeY(505), label: 'P4', name: nodes.find(n => n.id === 'P4')?.name || '' }
  }

  // Safe exit points (all exit nodes)
  const exitNodes = nodes.filter(node => node.exit_node)
  const safeExits = exitNodes.map(node => ({
    x: normalizeX(node.x),
    y: normalizeY(node.y),
    label: node.id,
    name: node.name
  }))

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

  // Get camera node IDs
  const cameraNodeIds = new Set(Object.values(cameraNodeMap))

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
          
          {/* Node connections (paths between adjacent nodes) */}
          <g className="node-connections">
            {(() => {
              const drawnConnections = new Set()
              return nodes.map(node => {
                const nodeX = normalizeX(node.x)
                const nodeY = normalizeY(node.y)
                return node.adjacent.map(adjId => {
                  // Avoid drawing duplicate connections
                  const connectionKey = [node.id, adjId].sort().join('-')
                  if (drawnConnections.has(connectionKey)) return null
                  drawnConnections.add(connectionKey)
                  
                  const adjNode = nodeMap.get(adjId)
                  if (!adjNode) return null
                  const adjX = normalizeX(adjNode.x)
                  const adjY = normalizeY(adjNode.y)
                  return (
                    <line
                      key={connectionKey}
                      x1={nodeX}
                      y1={nodeY}
                      x2={adjX}
                      y2={adjY}
                      stroke={fireDetected ? '#4A5568' : '#7F8C8D'}
                      strokeWidth="2"
                      opacity="0.3"
                    />
                  )
                })
              })
            })()}
          </g>

          {/* Danger radius (when fire detected) */}
          {fireDetected && firePosition && (
            <circle
              cx={firePosition.x}
              cy={firePosition.y}
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
            const routePath = `M ${route.from.x} ${route.from.y} Q ${(route.from.x + route.to.x) / 2} ${(route.from.y + route.to.y) / 2} ${route.to.x} ${route.to.y}`
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

          {/* All nodes (non-exit, non-camera nodes) */}
          {nodes.map(node => {
            const nodeX = normalizeX(node.x)
            const nodeY = normalizeY(node.y)
            const isCameraNode = cameraNodeIds.has(node.id)
            const isExitNode = node.exit_node

            // Skip camera nodes and exit nodes (rendered separately)
            if (isCameraNode || isExitNode) return null

            return (
              <g key={node.id} className="map-node">
                <circle
                  cx={nodeX}
                  cy={nodeY}
                  r="6"
                  fill="#7F8C8D"
                  stroke="#7F8C8D"
                  strokeWidth="2"
                  className="node-dot"
                  opacity="0.6"
                />
              </g>
            )
          })}

          {/* Camera nodes */}
          {Object.entries(cameraPositions).map(([cameraId, pos]) => {
            const isFireNode = fireDetected && activeCamera === cameraId
            const nodeId = cameraNodeMap[cameraId]
            const node = nodeMap.get(nodeId)
            const isExitNode = node?.exit_node || false

            return (
              <g key={cameraId} className={`camera-node ${isFireNode ? 'fire-node' : ''}`}>
                {/* Pulsing halo for fire node */}
                {isFireNode && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="25"
                    fill="none"
                    stroke="#FF3B3B"
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
                {/* Main node - larger if it's also an exit */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isExitNode ? "14" : "12"}
                  fill={isFireNode ? '#FF3B3B' : '#E4E4E4'}
                  stroke={isFireNode ? '#FF3B3B' : (isExitNode ? '#34D399' : '#E4E4E4')}
                  strokeWidth={isExitNode ? "3" : "2"}
                  className="node-dot"
                >
                  {isFireNode && (
                    <animate
                      attributeName="r"
                      values={isExitNode ? "14;17;14" : "12;15;12"}
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
                {/* Node label */}
                <text
                  x={pos.x}
                  y={pos.y - 20}
                  fill={isFireNode ? '#FF3B3B' : '#E4E4E4'}
                  fontSize="14"
                  fontWeight="600"
                  textAnchor="middle"
                  className="node-label"
                >
                  {cameraId}
                </text>
                <text
                  x={pos.x}
                  y={pos.y - 5}
                  fill="#7F8C8D"
                  fontSize="10"
                  textAnchor="middle"
                  className="node-location"
                >
                  {pos.label}
                </text>
                {/* Exit indicator for camera nodes that are also exits */}
                {isExitNode && !isFireNode && (
                  <text
                    x={pos.x}
                    y={pos.y + 25}
                    fill="#34D399"
                    fontSize="9"
                    textAnchor="middle"
                    className="exit-indicator"
                  >
                    EXIT
                  </text>
                )}
              </g>
            )
          })}

          {/* Safe exit markers (exit nodes that are not camera nodes) */}
          {safeExits.map((exit) => {
            // Don't render exit if it's also a camera node (already rendered above)
            const exitNodeId = exit.label
            if (cameraNodeIds.has(exitNodeId)) return null
            
            return (
              <g key={exit.label} className="safe-exit">
                <circle
                  cx={exit.x}
                  cy={exit.y}
                  r="10"
                  fill="#34D399"
                  stroke="#34D399"
                  strokeWidth="2"
                  opacity={fireDetected ? 1 : 0.7}
                />
                <text
                  x={exit.x}
                  y={exit.y - 15}
                  fill="#34D399"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                  opacity={fireDetected ? 1 : 0.7}
                >
                  {exit.label}
                </text>
                <text
                  x={exit.x}
                  y={exit.y + 20}
                  fill="#34D399"
                  fontSize="9"
                  textAnchor="middle"
                  opacity={fireDetected ? 1 : 0.7}
                >
                  EXIT
                </text>
              </g>
            )
          })}

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

