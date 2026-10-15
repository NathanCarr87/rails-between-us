import React, { useEffect } from 'react';
import type { City, DestinationTicket, Route } from '../game/model/types';
import { CITY_COORDINATES } from './cityCoordinates';
import { isTicketCompleted } from '../game/state/gameEngine';

export interface DestinationTicketDetailModalProps {
  ticket: DestinationTicket;
  cities: Record<string, City>;
  routes: Record<string, Route>;
  claimedRoutes?: string[];
  onClose: () => void;
}

export const DestinationTicketDetailModal: React.FC<DestinationTicketDetailModalProps> = ({
  ticket,
  cities,
  routes,
  claimedRoutes = [],
  onClose,
}) => {
  // Listen for Escape key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!ticket) return null;

  const cityAName = cities[ticket.cityA]?.name || ticket.cityA;
  const cityBName = cities[ticket.cityB]?.name || ticket.cityB;
  const completed = isTicketCompleted(ticket, claimedRoutes, routes);

  const coordA = CITY_COORDINATES[ticket.cityA];
  const coordB = CITY_COORDINATES[ticket.cityB];

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      data-testid="destination-ticket-detail-modal"
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Destination Ticket Details</h2>
          <button
            style={styles.closeIconBtn}
            onClick={onClose}
            aria-label="Close ticket details modal"
            data-testid="close-ticket-detail-btn"
          >
            ✕
          </button>
        </div>

        {/* Route Banner */}
        <div style={styles.routeHeader}>
          <span style={styles.cityA}>{cityAName}</span>
          <span style={styles.arrow}>➔</span>
          <span style={styles.cityB}>{cityBName}</span>
        </div>

        {/* Info Badges */}
        <div style={styles.badgeRow}>
          <div style={styles.pointsBadge} data-testid="ticket-detail-points">
            <span style={styles.pointsValue}>{ticket.points}</span>
            <span style={styles.pointsLabel}>Points</span>
          </div>

          <div
            style={{
              ...styles.statusBadge,
              backgroundColor: completed ? '#c6f6d5' : '#feebc8',
              color: completed ? '#22543d' : '#7b341e',
              borderColor: completed ? '#38a169' : '#dd6b20',
            }}
            data-testid="ticket-detail-status"
          >
            {completed ? '✓ Completed' : 'Incomplete'}
          </div>
        </div>

        {/* Visual Map Representation */}
        <div style={styles.mapContainer}>
          <h4 style={styles.mapTitle}>Route Overview</h4>
          <svg
            viewBox="0 0 1000 670"
            style={styles.mapSvg}
            preserveAspectRatio="xMidYMid meet"
            aria-label={`Route map showing path from ${cityAName} to ${cityBName}`}
          >
            {/* Map background */}
            <rect width="1000" height="670" fill="#f8fafc" rx="12" />
            <rect
              x="10"
              y="10"
              width="980"
              height="650"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2"
              rx="10"
            />

            {/* Background Routes */}
            <g id="mini-routes">
              {Object.values(routes).map((route) => {
                const cA = CITY_COORDINATES[route.cityA];
                const cB = CITY_COORDINATES[route.cityB];
                if (!cA || !cB) return null;

                const isClaimed = claimedRoutes.includes(route.routeId);

                return (
                  <line
                    key={route.routeId}
                    x1={cA.x}
                    y1={cA.y}
                    x2={cB.x}
                    y2={cB.y}
                    stroke={isClaimed ? '#3182ce' : '#cbd5e0'}
                    strokeWidth={isClaimed ? 5 : 2}
                    opacity={isClaimed ? 0.9 : 0.4}
                    strokeDasharray={isClaimed ? undefined : '4,4'}
                  />
                );
              })}
            </g>

            {/* Direct Ticket Guide Line between Origin & Destination */}
            {coordA && coordB && (
              <line
                x1={coordA.x}
                y1={coordA.y}
                x2={coordB.x}
                y2={coordB.y}
                stroke={completed ? '#38a169' : '#dd6b20'}
                strokeWidth="4"
                strokeDasharray="8,6"
                opacity="0.85"
              />
            )}

            {/* Other Cities */}
            <g id="mini-other-cities">
              {Object.values(cities).map((city) => {
                if (city.id === ticket.cityA || city.id === ticket.cityB) return null;
                const c = CITY_COORDINATES[city.id];
                if (!c) return null;
                return <circle key={city.id} cx={c.x} cy={c.y} r="4" fill="#a0aec0" opacity="0.6" />;
              })}
            </g>

            {/* Origin City Pin */}
            {coordA && (
              <g transform={`translate(${coordA.x}, ${coordA.y})`}>
                <circle r="14" fill="#38a169" opacity="0.25" />
                <circle r="9" fill="#38a169" stroke="#ffffff" strokeWidth="2.5" />
                <text
                  y="-14"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#22543d"
                  stroke="#ffffff"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  Origin: {cityAName}
                </text>
              </g>
            )}

            {/* Destination City Pin */}
            {coordB && (
              <g transform={`translate(${coordB.x}, ${coordB.y})`}>
                <circle r="14" fill="#e53e3e" opacity="0.25" />
                <circle r="9" fill="#e53e3e" stroke="#ffffff" strokeWidth="2.5" />
                <text
                  y="22"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#742a2a"
                  stroke="#ffffff"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  Destination: {cityBName}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Modal Footer */}
        <div style={styles.footer}>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            data-testid="close-ticket-detail-footer-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
    boxSizing: 'border-box',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px 24px',
    maxWidth: '520px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #edf2f7',
    paddingBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1a202c',
  },
  closeIconBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#718096',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  routeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    backgroundColor: '#ebf8ff',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #bee3f8',
  },
  cityA: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  arrow: {
    fontSize: '18px',
    color: '#3182ce',
  },
  cityB: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: '12px',
  },
  pointsBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: '#edf2f7',
    borderRadius: '8px',
    minWidth: '80px',
  },
  pointsValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  pointsLabel: {
    fontSize: '11px',
    color: '#718096',
    fontWeight: '600',
  },
  statusBadge: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    border: '1px solid',
  },
  mapContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mapTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#4a5568',
  },
  mapSvg: {
    width: '100%',
    height: 'auto',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: '1px solid #edf2f7',
    paddingTop: '12px',
  },
  closeBtn: {
    padding: '8px 18px',
    backgroundColor: '#e2e8f0',
    color: '#2d3748',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
  },
};
