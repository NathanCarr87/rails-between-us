import React from 'react';
import type { CardColor, City, DestinationTicket, Route, TrainCard } from '../game/model/types';
import { isTicketCompleted } from '../game/state/gameEngine';

export interface PlayerHandProps {
  cards: TrainCard[];
  destinationTickets?: DestinationTicket[];
  cities?: Record<string, City>;
  routes?: Record<string, Route>;
  claimedRoutes?: string[];
  isCurrentTurn?: boolean;
  selectedColor?: CardColor;
  onSelectColor?: (color: CardColor) => void;
}

const COLOR_MAP: Record<CardColor, { bg: string; text: string; label: string }> = {
  red: { bg: '#e53e3e', text: '#ffffff', label: 'Red' },
  blue: { bg: '#3182ce', text: '#ffffff', label: 'Blue' },
  green: { bg: '#38a169', text: '#ffffff', label: 'Green' },
  yellow: { bg: '#d69e2e', text: '#1a202c', label: 'Yellow' },
  purple: { bg: '#805ad5', text: '#ffffff', label: 'Purple' },
  orange: { bg: '#dd6b20', text: '#ffffff', label: 'Orange' },
  black: { bg: '#2d3748', text: '#ffffff', label: 'Black' },
  white: { bg: '#ffffff', text: '#2d3748', label: 'White' },
  locomotive: { bg: 'linear-gradient(135deg, #e53e3e, #3182ce, #38a169, #d69e2e)', text: '#ffffff', label: 'Locomotive (Wild)' },
};

const ALL_COLORS: CardColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'black',
  'white',
  'locomotive',
];

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  destinationTickets = [],
  cities = {},
  routes = {},
  claimedRoutes = [],
  isCurrentTurn = false,
  selectedColor,
  onSelectColor,
}) => {
  // Count cards by color
  const counts: Record<CardColor, number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
    purple: 0,
    orange: 0,
    black: 0,
    white: 0,
    locomotive: 0,
  };

  cards.forEach((card) => {
    if (counts[card.color] !== undefined) {
      counts[card.color]++;
    }
  });

  return (
    <div style={styles.container} data-testid="player-hand">
      <div style={styles.header}>
        <h3 style={styles.title}>Your Hand ({cards.length} cards)</h3>
        {isCurrentTurn && <span style={styles.yourTurnBadge}>Your Turn</span>}
      </div>

      {cards.length === 0 ? (
        <p style={styles.emptyText}>You have no train cards in hand. Draw cards on your turn!</p>
      ) : (
        <div style={styles.cardGrid}>
          {ALL_COLORS.map((col) => {
            const count = counts[col];
            if (count === 0 && !onSelectColor) return null;

            const colorMeta = COLOR_MAP[col];
            const isSelected = selectedColor === col;

            return (
              <div
                key={col}
                style={{
                  ...styles.cardBadge,
                  background: colorMeta.bg,
                  color: colorMeta.text,
                  border: isSelected ? '3px solid #2b6cb0' : '1px solid #cbd5e0',
                  opacity: count === 0 ? 0.4 : 1,
                  cursor: onSelectColor ? 'pointer' : 'default',
                }}
                onClick={() => onSelectColor && onSelectColor(col)}
                data-testid={`hand-card-${col}`}
              >
                <span style={styles.cardLabel}>{colorMeta.label}</span>
                <span style={styles.cardCount}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Local Player's Destination Tickets Section */}
      <div style={styles.ticketsSection} data-testid="player-tickets-section">
        <h4 style={styles.subTitle}>Your Destination Tickets ({destinationTickets.length})</h4>
        {destinationTickets.length === 0 ? (
          <p style={styles.emptyText}>You have no active destination tickets.</p>
        ) : (
          <div style={styles.ticketGrid}>
            {destinationTickets.map((ticket) => {
              const cityAName = cities[ticket.cityA]?.name || ticket.cityA;
              const cityBName = cities[ticket.cityB]?.name || ticket.cityB;
              const completed = isTicketCompleted(ticket, claimedRoutes, routes);

              return (
                <div
                  key={ticket.id}
                  style={{
                    ...styles.ticketBadge,
                    borderColor: completed ? '#38a169' : '#cbd5e0',
                    backgroundColor: completed ? '#f0fff4' : '#f7fafc',
                  }}
                  data-testid={`kept-ticket-${ticket.id}`}
                >
                  <div style={styles.ticketHeader}>
                    <span style={styles.ticketRoute}>
                      <strong>{cityAName}</strong> ➔ <strong>{cityBName}</strong>
                    </span>
                    <span style={styles.ticketPoints}>{ticket.points} pts</span>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: completed ? '#c6f6d5' : '#e2e8f0',
                      color: completed ? '#22543d' : '#4a5568',
                    }}
                  >
                    {completed ? '✓ Completed' : 'Incomplete'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#2d3748',
  },
  yourTurnBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: '#38a169',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  emptyText: {
    margin: 0,
    color: '#718096',
    fontSize: '14px',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '10px',
  },
  cardBadge: {
    padding: '10px 12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
    transition: 'transform 0.1s ease',
  },
  cardLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardCount: {
    fontSize: '20px',
    fontWeight: '800',
  },
  ticketsSection: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  subTitle: {
    margin: 0,
    fontSize: '15px',
    color: '#2d3748',
  },
  ticketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '10px',
  },
  ticketBadge: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  ticketHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
  },
  ticketRoute: {
    fontSize: '13px',
    color: '#2d3748',
  },
  ticketPoints: {
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#2b6cb0',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
  },
};
