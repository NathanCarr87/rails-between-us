import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardState, Player, TrainColor } from '../game/model/types';
import { CITY_COORDINATES } from './cityCoordinates';

export interface GameBoardProps {
  boardState: BoardState;
  players: Record<string, Player>;
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  onClaimRoute?: (routeId: string) => void;
}

const TRAIN_COLOR_HEX: Record<TrainColor | 'any', string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  green: '#38a169',
  yellow: '#d69e2e',
  purple: '#805ad5',
  orange: '#dd6b20',
  black: '#2d3748',
  white: '#e2e8f0',
  any: '#a0aec0',
};

const BOARD_WIDTH = 1000;
const BOARD_HEIGHT = 670;
const MIN_SCALE = 1.0;
const DEFAULT_SCALE = 1.25;
const MAX_SCALE = 3.0;

export const GameBoard: React.FC<GameBoardProps> = ({
  boardState,
  players,
  selectedRouteId,
  onSelectRoute,
  onClaimRoute,
}) => {
  const { cities, routes } = boardState;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Default zoom 1.25x centered on playable USA board
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);
  const [pan, setPan] = useState<{ vx: number; vy: number }>(() => {
    const vw = BOARD_WIDTH / DEFAULT_SCALE;
    const vh = BOARD_HEIGHT / DEFAULT_SCALE;
    return {
      vx: (BOARD_WIDTH - vw) / 2,
      vy: (BOARD_HEIGHT - vh) / 2,
    };
  });

  const isDraggingRef = useRef<boolean>(false);
  const pointerStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const touchPinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  const clampPan = useCallback((vx: number, vy: number, currentScale: number) => {
    const vw = BOARD_WIDTH / currentScale;
    const vh = BOARD_HEIGHT / currentScale;
    const maxX = Math.max(0, BOARD_WIDTH - vw);
    const maxY = Math.max(0, BOARD_HEIGHT - vh);
    return {
      vx: Math.max(0, Math.min(maxX, vx)),
      vy: Math.max(0, Math.min(maxY, vy)),
    };
  }, []);

  const zoomTo = useCallback(
    (targetScale: number, cx: number, cy: number) => {
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetScale));
      const currentVw = BOARD_WIDTH / scale;
      const nextVw = BOARD_WIDTH / nextScale;

      const ratio = nextVw / currentVw;
      const newVx = cx - (cx - pan.vx) * ratio;
      const newVy = cy - (cy - pan.vy) * ratio;

      const clamped = clampPan(newVx, newVy, nextScale);
      setScale(nextScale);
      setPan(clamped);
    },
    [scale, pan.vx, pan.vy, clampPan]
  );

  const handleZoomIn = () => {
    const currentVw = BOARD_WIDTH / scale;
    const currentVh = BOARD_HEIGHT / scale;
    const cx = pan.vx + currentVw / 2;
    const cy = pan.vy + currentVh / 2;
    zoomTo(scale * 1.25, cx, cy);
  };

  const handleZoomOut = () => {
    const currentVw = BOARD_WIDTH / scale;
    const currentVh = BOARD_HEIGHT / scale;
    const cx = pan.vx + currentVw / 2;
    const cy = pan.vy + currentVh / 2;
    zoomTo(scale / 1.25, cx, cy);
  };

  const handleResetZoom = () => {
    const vw = BOARD_WIDTH / DEFAULT_SCALE;
    const vh = BOARD_HEIGHT / DEFAULT_SCALE;
    setScale(DEFAULT_SCALE);
    setPan({
      vx: (BOARD_WIDTH - vw) / 2,
      vy: (BOARD_HEIGHT - vh) / 2,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      vx: pan.vx,
      vy: pan.vy,
    };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointerStartRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      isDraggingRef.current = true;
    }

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const vw = BOARD_WIDTH / scale;
      const vh = BOARD_HEIGHT / scale;

      const boardDx = (dx / rect.width) * vw;
      const boardDy = (dy / rect.height) * vh;

      const rawVx = pointerStartRef.current.vx - boardDx;
      const rawVy = pointerStartRef.current.vy - boardDy;

      setPan(clampPan(rawVx, rawVy, scale));
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
    if (isDraggingRef.current) {
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const vw = BOARD_WIDTH / scale;
    const vh = BOARD_HEIGHT / scale;

    const cx = pan.vx + (mouseX / rect.width) * vw;
    const cy = pan.vy + (mouseY / rect.height) * vh;

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomTo(scale * factor, cx, cy);
  };

  // Touch pinch-to-zoom support
  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchPinchRef.current = { startDist: dist, startScale: scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && touchPinchRef.current && svgRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchPinchRef.current.startDist;

      const rect = svgRef.current.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const vw = BOARD_WIDTH / scale;
      const vh = BOARD_HEIGHT / scale;

      const cx = pan.vx + (midX / rect.width) * vw;
      const cy = pan.vy + (midY / rect.height) * vh;

      zoomTo(touchPinchRef.current.startScale * ratio, cx, cy);
    }
  };

  const handleTouchEnd = () => {
    touchPinchRef.current = null;
  };

  // Prevent default pinch zoom / scroll interference when interacting with board SVG element
  useEffect(() => {
    const elem = svgRef.current;
    if (!elem) return;

    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    elem.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    return () => {
      elem.removeEventListener('touchmove', preventDefaultTouch);
    };
  }, []);

  // Group routes by pair (cityA - cityB sorted) to calculate offset for parallel routes
  const routeGroups: Record<string, string[]> = {};
  Object.values(routes).forEach((route) => {
    const key = [route.cityA, route.cityB].sort().join('--');
    if (!routeGroups[key]) {
      routeGroups[key] = [];
    }
    routeGroups[key].push(route.routeId);
  });

  const selectedRoute = selectedRouteId ? routes[selectedRouteId] : null;

  const vw = BOARD_WIDTH / scale;
  const vh = BOARD_HEIGHT / scale;
  const viewBoxStr = `${pan.vx} ${pan.vy} ${vw} ${vh}`;

  return (
    <div style={styles.boardWrapper} data-testid="game-board-wrapper">
      {/* Zoom Controls Overlay */}
      <div style={styles.zoomControls} data-testid="map-zoom-controls">
        <button
          type="button"
          style={styles.zoomBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          aria-label="Zoom in"
          title="Zoom in (+)"
          data-testid="map-zoom-in"
        >
          +
        </button>
        <button
          type="button"
          style={styles.zoomBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          aria-label="Zoom out"
          title="Zoom out (−)"
          data-testid="map-zoom-out"
        >
          −
        </button>
        <button
          type="button"
          style={styles.zoomResetBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleResetZoom();
          }}
          aria-label="Reset zoom"
          title="Reset zoom"
          data-testid="map-zoom-reset"
        >
          Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={viewBoxStr}
        style={{ ...styles.svg, touchAction: 'none' }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Game Board USA Map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Map Styling */}
        <rect width="1000" height="670" fill="#f0f4f8" rx="16" />
        <rect
          x="10"
          y="10"
          width="980"
          height="650"
          fill="none"
          stroke="#cbd5e0"
          strokeWidth="2"
          rx="12"
        />

        {/* Routes */}
        <g id="routes-layer">
          {Object.values(routes).map((route) => {
            const coordA = CITY_COORDINATES[route.cityA];
            const coordB = CITY_COORDINATES[route.cityB];

            if (!coordA || !coordB) return null;

            const key = [route.cityA, route.cityB].sort().join('--');
            const group = routeGroups[key] || [];
            const routeIndex = group.indexOf(route.routeId);
            const totalInGroup = group.length;

            // Offset parallel routes perpendicular to the connecting line
            const dx = coordB.x - coordA.x;
            const dy = coordB.y - coordA.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;

            const offsetDistance = 12;
            const offsetMultiplier = routeIndex - (totalInGroup - 1) / 2;

            const startX = coordA.x + nx * offsetDistance * offsetMultiplier;
            const startY = coordA.y + ny * offsetDistance * offsetMultiplier;
            const endX = coordB.x + nx * offsetDistance * offsetMultiplier;
            const endY = coordB.y + ny * offsetDistance * offsetMultiplier;

            const owner = route.ownerPlayerId ? players[route.ownerPlayerId] : null;
            const isSelected = selectedRouteId === route.routeId;
            const routeColorHex = TRAIN_COLOR_HEX[route.colorRequirement];

            return (
              <g
                key={route.routeId}
                onClick={() => {
                  if (isDraggingRef.current) return;
                  onSelectRoute?.(route.routeId);
                }}
                style={{ cursor: onSelectRoute ? 'pointer' : 'default' }}
                data-testid={`route-group-${route.routeId}`}
                data-selected={isSelected}
              >
                {/* Highlight layer when selected */}
                {isSelected && (
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="#dd6b20"
                    strokeWidth={16}
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                )}

                {/* Background line / hit area */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={isSelected ? '#3182ce' : '#cbd5e0'}
                  strokeWidth={isSelected ? 12 : 10}
                  strokeLinecap="round"
                  opacity={isSelected ? 0.9 : 0.6}
                />

                {/* Main route track / line */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={owner ? owner.color : routeColorHex}
                  strokeWidth={owner ? 7 : 5}
                  strokeDasharray={owner ? undefined : '8,4'}
                  strokeLinecap="round"
                />

                {/* Claimed Route Trains Indicator */}
                {owner && (
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="#ffffff"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                )}

                {/* Route Length & Color Requirement Tag */}
                <g transform={`translate(${(startX + endX) / 2}, ${(startY + endY) / 2})`}>
                  <circle
                    r={isSelected ? '10' : '8'}
                    fill={owner ? owner.color : isSelected ? '#feebc8' : '#ffffff'}
                    stroke={isSelected ? '#dd6b20' : routeColorHex}
                    strokeWidth={isSelected ? '3' : '2'}
                  />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fontSize={isSelected ? '10' : '9'}
                    fontWeight="bold"
                    fill={owner ? '#ffffff' : isSelected ? '#7b341e' : '#2d3748'}
                  >
                    {route.length}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* Cities */}
        <g id="cities-layer">
          {Object.values(cities).map((city) => {
            const coord = CITY_COORDINATES[city.id];
            if (!coord) return null;

            return (
              <g key={city.id} transform={`translate(${coord.x}, ${coord.y})`}>
                <circle r="7" fill="#ffffff" stroke="#2b6cb0" strokeWidth="3" />
                <circle r="3" fill="#2b6cb0" />
                <text
                  x="0"
                  y={coord.y > 580 ? -10 : 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill="#1a202c"
                  stroke="#ffffff"
                  strokeWidth="3"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {city.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Interactive Selected Route Action Panel */}
      {selectedRoute && (
        <div style={styles.selectedRouteBanner} data-testid="selected-route-panel">
          <div style={styles.routeDetails}>
            <span style={styles.routeCities}>
              {cities[selectedRoute.cityA]?.name || selectedRoute.cityA} ↔{' '}
              {cities[selectedRoute.cityB]?.name || selectedRoute.cityB}
            </span>
            <div style={styles.routeBadgeGroup}>
              <span style={styles.badge} data-testid="selected-route-length">
                Length: {selectedRoute.length}
              </span>
              <span
                style={{
                  ...styles.colorBadge,
                  backgroundColor: TRAIN_COLOR_HEX[selectedRoute.colorRequirement],
                  color:
                    selectedRoute.colorRequirement === 'white' ||
                    selectedRoute.colorRequirement === 'yellow' ||
                    selectedRoute.colorRequirement === 'any'
                      ? '#1a202c'
                      : '#ffffff',
                }}
                data-testid="selected-route-color"
              >
                Color: {selectedRoute.colorRequirement.toUpperCase()}
              </span>
            </div>
          </div>

          <div>
            {selectedRoute.ownerPlayerId ? (
              <div style={styles.claimedBadge} data-testid="selected-route-owner">
                Owned by {players[selectedRoute.ownerPlayerId]?.displayName || 'Player'}
              </div>
            ) : (
              onClaimRoute && (
                <button
                  style={styles.claimBtn}
                  onClick={() => onClaimRoute(selectedRoute.routeId)}
                  data-testid="board-claim-route-btn"
                >
                  Claim Route
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  boardWrapper: {
    position: 'relative',
    width: '100%',
    margin: '0',
    padding: '0',
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  zoomControls: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(4px)',
    padding: '6px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  zoomBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: '1px solid #cbd5e0',
    backgroundColor: '#ffffff',
    color: '#2d3748',
    fontSize: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  zoomResetBtn: {
    padding: '4px 6px',
    minHeight: '28px',
    borderRadius: '6px',
    border: '1px solid #cbd5e0',
    backgroundColor: '#ffffff',
    color: '#2d3748',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    userSelect: 'none',
    textAlign: 'center',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  svg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
    userSelect: 'none',
  },
  selectedRouteBanner: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#ebf8ff',
    border: '1.5px solid #3182ce',
    borderRadius: '8px',
    gap: '8px',
  },
  routeDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
  },
  routeCities: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  routeBadgeGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  badge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#2d3748',
    backgroundColor: '#e2e8f0',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  colorBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid rgba(0,0,0,0.15)',
  },
  claimedBadge: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#2f855a',
    backgroundColor: '#c6f6d5',
    padding: '4px 10px',
    borderRadius: '6px',
  },
  claimBtn: {
    padding: '6px 14px',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
};
