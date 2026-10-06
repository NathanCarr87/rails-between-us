import React from 'react';
import type { Game } from '../game/model/types';

export interface PlayerStatusProps {
  game: Game;
  localPlayerId?: string;
  onDrawCards?: (playerId: string) => void;
  onDrawDestinationTickets?: (playerId: string) => void;
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({
  game,
  localPlayerId,
  onDrawCards,
  onDrawDestinationTickets,
}) => {
  const currentPlayer = game.currentPlayerId ? game.players[game.currentPlayerId] : null;
  const isLocalTurn = localPlayerId && localPlayerId === game.currentPlayerId;

  return (
    <div style={styles.container} data-testid="player-status-container">
      {/* Game Header Status Bar */}
      <div style={styles.headerBar}>
        <div style={styles.statusItem}>
          <span style={styles.label}>Game Status:</span>
          <span style={styles.badge} data-testid="game-status-badge">{game.status}</span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Turn:</span>
          <strong>#{game.turnNumber}</strong>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Current Turn:</span>
          <span style={styles.currentPlayerName} data-testid="current-player-name">
            {currentPlayer ? currentPlayer.displayName : 'None'}
          </span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Train Deck:</span>
          <span>{game.trainCardDeck.length} cards</span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Ticket Deck:</span>
          <span>{game.destinationTicketDeck.length} tickets</span>
        </div>
      </div>

      {/* Players List Grid */}
      <div style={styles.playerGrid}>
        {game.playerOrder.map((pid) => {
          const player = game.players[pid];
          const isCurrent = pid === game.currentPlayerId;

          return (
            <div
              key={pid}
              style={{
                ...styles.playerCard,
                borderColor: player.color,
                backgroundColor: isCurrent ? '#f0fff4' : '#ffffff',
              }}
            >
              <div style={styles.playerHeader}>
                <span style={{ ...styles.colorDot, backgroundColor: player.color }} />
                <span style={styles.playerName}>{player.displayName}</span>
                {isCurrent && <span style={styles.turnBadge}>Active</span>}
              </div>

              <div style={styles.statsRow}>
                <div>Score: <strong>{player.score}</strong></div>
                <div>Trains: <strong>{player.trainsRemaining}</strong></div>
                <div>Cards: <strong>{player.trainCards.length}</strong></div>
                <div>Tickets: <strong>{player.destinationTickets?.length ?? 0}</strong></div>
                <div>Routes: <strong>{player.claimedRoutes.length}</strong></div>
              </div>

              {pid === localPlayerId && (onDrawCards || onDrawDestinationTickets) && (
                <div style={styles.actions}>
                  {onDrawCards && (
                    <button
                      style={{
                        ...styles.btnDraw,
                        opacity: isCurrent && isLocalTurn ? 1 : 0.5,
                        cursor: isCurrent && isLocalTurn ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => onDrawCards(pid)}
                      disabled={!isCurrent || !isLocalTurn || game.trainCardDeck.length + game.trainCardDiscardPile.length === 0}
                    >
                      {isLocalTurn ? 'Draw 2 Cards' : 'Not Your Turn'}
                    </button>
                  )}
                  {onDrawDestinationTickets && (
                    <button
                      style={{
                        ...styles.btnDraw,
                        opacity: isCurrent && isLocalTurn ? 1 : 0.5,
                        cursor: isCurrent && isLocalTurn ? 'pointer' : 'not-allowed',
                      }}
                      onClick={() => onDrawDestinationTickets(pid)}
                      disabled={!isCurrent || !isLocalTurn || game.destinationTicketDeck.length === 0}
                      data-testid="draw-tickets-btn"
                    >
                      {isLocalTurn ? 'Draw Tickets' : 'Not Your Turn'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    boxSizing: 'border-box',
  },
  headerBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: '12px 16px',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    fontSize: '14px',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    color: '#718096',
    fontWeight: '500',
  },
  badge: {
    textTransform: 'uppercase',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#e2e8f0',
    color: '#2d3748',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  currentPlayerName: {
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  playerCard: {
    borderRadius: '10px',
    border: '2px solid',
    padding: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  playerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  colorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  playerName: {
    fontWeight: 'bold',
    fontSize: '15px',
    flexGrow: 1,
  },
  turnBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#38a169',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    fontSize: '13px',
    color: '#4a5568',
  },
  actions: {
    marginTop: '10px',
    display: 'flex',
    gap: '6px',
  },
  btnDraw: {
    flex: 1,
    padding: '6px 8px',
    backgroundColor: '#edf2f7',
    border: '1px solid #cbd5e0',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    color: '#2d3748',
  },
};
