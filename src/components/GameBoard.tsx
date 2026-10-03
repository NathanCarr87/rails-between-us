import React from 'react';
import type { BoardState, Player, TrainColor } from '../game/model/types';
import { CITY_COORDINATES } from './cityCoordinates';

export interface GameBoardProps {
  boardState: BoardState;
  players: Record<string, Player>;
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
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

export const GameBoard: React.FC<GameBoardProps> = ({
  boardState,
  players,
  selectedRouteId,
  onSelectRoute,
}) => {
  const { cities, routes } = boardState;

  // Group routes by pair (cityA - cityB sorted) to calculate offset for parallel routes
  const routeGroups: Record<string, string[]> = {};
  Object.values(routes).forEach((route) => {
    const key = [route.cityA, route.cityB].sort().join('--');
    if (!routeGroups[key]) {
      routeGroups[key] = [];
    }
    routeGroups[key].push(route.routeId);
  });

  return (
    <div style={styles.boardWrapper}>
      <svg
        viewBox="0 0 1000 670"
        style={styles.svg}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Game Board USA Map"
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
                onClick={() => onSelectRoute?.(route.routeId)}
                style={{ cursor: onSelectRoute ? 'pointer' : 'default' }}
              >
                {/* Background line / hit area */}
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={isSelected ? '#3182ce' : '#cbd5e0'}
                  strokeWidth={isSelected ? 14 : 10}
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
                    r="8"
                    fill={owner ? owner.color : '#ffffff'}
                    stroke={isSelected ? '#2b6cb0' : routeColorHex}
                    strokeWidth="2"
                  />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fontSize="9"
                    fontWeight="bold"
                    fill={owner ? '#ffffff' : '#2d3748'}
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
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  boardWrapper: {
    width: '100%',
    maxWidth: '1000px',
    margin: '0 auto',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  svg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
};
