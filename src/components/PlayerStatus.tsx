import React from 'react';
import type { Game } from '../game/model/types';

export interface PlayerStatusProps {
  game: Game;
  localPlayerId?: string;
  onDrawCards?: (playerId: string) => void;
  onDrawDestinationTickets?: (playerId: string) => void;
  section?: 'all' | 'tracker' | 'summaries';
}

export const TurnTracker: React.FC<{ game: Game }> = ({ game }) => {
  const currentPlayer = game.currentPlayerId ? game.players[game.currentPlayerId] : null;

  return (
    <div style={styles.trackerContainer} data-testid="turn-tracker-container">
      {/* Final Round Banner */}
      {game.isFinalRound && game.phase === 'playing' && (
        <div style={styles.finalRoundBanner} data-testid="final-round-banner">
          🔔 <strong>Final Round!</strong> Each player gets one last turn before the game ends.
        </div>
      )}

      {/* Compact Turn Tracker Bar */}
      <div style={styles.headerBar}>
        <div style={styles.statusItem}>
          <span style={styles.label}>Status:</span>
          <span style={styles.badge} data-testid="game-status-badge">{game.status}</span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Turn:</span>
          <strong style={styles.val}>#{game.turnNumber}</strong>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Turn Active:</span>
          <span style={styles.currentPlayerName} data-testid="current-player-name">
            {currentPlayer ? currentPlayer.displayName : 'None'}
          </span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Train Deck:</span>
          <span style={styles.val}>{game.trainCardDeck.length} cards</span>
        </div>
        <div style={styles.statusItem}>
          <span style={styles.label}>Ticket Deck:</span>
          <span style={styles.val}>{game.destinationTicketDeck.length} tickets</span>
        </div>
      </div>
    </div>
  );
};

export const PlayerSummaries: React.FC<{
  game: Game;
  localPlayerId?: string;
  onDrawCards?: (playerId: string) => void;
  onDrawDestinationTickets?: (playerId: string) => void;
}> = ({ game, localPlayerId, onDrawCards, onDrawDestinationTickets }) => {
  const isLocalTurn = localPlayerId && localPlayerId === game.currentPlayerId;

  return (
    <div style={styles.playerSummariesWrapper} data-testid="player-summaries-container">
      <div style={styles.playerGrid}>
        {game.playerOrder.map((pid) => {
          const player = game.players[pid];
          const isCurrent = pid === game.currentPlayerId;

          return (
            <div
              key={pid}
              style={{
                ...styles.summaryCard,
                borderColor: isCurrent ? player.color : '#e2e8f0',
                backgroundColor: isCurrent ? '#f0fff4' : '#ffffff',
                boxShadow: isCurrent ? `0 0 0 2px ${player.color}40, 0 1px 3px rgba(0,0,0,0.08)` : '0 1px 2px rgba(0,0,0,0.04)',
              }}
              data-testid={`player-summary-${pid}`}
            >
              <div style={styles.cardHeader}>
                <div style={styles.playerIdentity}>
                  <span style={{ ...styles.colorDot, backgroundColor: player.color }} />
                  <span style={styles.playerName}>
                    {player.displayName}
                    {pid === localPlayerId ? ' (You)' : ''}
                  </span>
                </div>
                {isCurrent && <span style={{ ...styles.turnBadge, backgroundColor: player.color }}>Active Turn</span>}
              </div>

              <div style={styles.compactStatsGrid}>
                <div style={styles.statItem} title="Score">
                  <span style={styles.statLabel}>Score:</span>
                  <span style={styles.statVal}>{player.score}</span>
                </div>
                <div style={styles.statItem} title="Trains remaining">
                  <span style={styles.statLabel}>Trains:</span>
                  <span style={styles.statVal}>{player.trainsRemaining}</span>
                </div>
                <div style={styles.statItem} title="Train cards in hand">
                  <span style={styles.statLabel}>Cards:</span>
                  <span style={styles.statVal}>{player.trainCards.length}</span>
                </div>
                <div style={styles.statItem} title="Destination tickets">
                  <span style={styles.statLabel}>Tickets:</span>
                  <span style={styles.statVal}>{player.destinationTickets?.length ?? 0}</span>
                </div>
              </div>

              {pid === localPlayerId && (onDrawCards || onDrawDestinationTickets) && (
                <div style={styles.actions}>
                  {onDrawCards && (
                    <button
                      style={{
                        ...styles.btnDrawCompact,
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
                        ...styles.btnDrawCompact,
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

export const PlayerStatus: React.FC<PlayerStatusProps> = ({
  game,
  localPlayerId,
  onDrawCards,
  onDrawDestinationTickets,
  section = 'all',
}) => {
  if (section === 'tracker') {
    return <TurnTracker game={game} />;
  }

  if (section === 'summaries') {
    return (
      <PlayerSummaries
        game={game}
        localPlayerId={localPlayerId}
        onDrawCards={onDrawCards}
        onDrawDestinationTickets={onDrawDestinationTickets}
      />
    );
  }

  return (
    <div style={styles.container} data-testid="player-status-container">
      <TurnTracker game={game} />
      <PlayerSummaries
        game={game}
        localPlayerId={localPlayerId}
        onDrawCards={onDrawCards}
        onDrawDestinationTickets={onDrawDestinationTickets}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
    boxSizing: 'border-box',
  },
  trackerContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    boxSizing: 'border-box',
  },
  playerSummariesWrapper: {
    width: '100%',
    boxSizing: 'border-box',
  },
  headerBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px 16px',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: '8px 14px',
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  finalRoundBanner: {
    backgroundColor: '#feebc8',
    color: '#744210',
    border: '1px solid #f6ad55',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'center',
    fontWeight: '500',
  },
  label: {
    color: '#718096',
    fontWeight: '500',
    fontSize: '12px',
  },
  val: {
    color: '#2d3748',
    fontSize: '13px',
  },
  badge: {
    textTransform: 'uppercase',
    fontSize: '10px',
    fontWeight: 'bold',
    backgroundColor: '#edf2f7',
    color: '#2d3748',
    padding: '2px 6px',
    borderRadius: '8px',
  },
  currentPlayerName: {
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px',
  },
  summaryCard: {
    borderRadius: '8px',
    border: '1.5px solid',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'all 0.15s ease-in-out',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
  },
  playerIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  colorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  playerName: {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#1a202c',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  turnBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#ffffff',
    padding: '1px 6px',
    borderRadius: '10px',
    flexShrink: 0,
  },
  compactStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: '4px 6px',
    borderRadius: '6px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '10px',
    color: '#718096',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  actions: {
    display: 'flex',
    gap: '6px',
  },
  btnDrawCompact: {
    flex: 1,
    padding: '4px 8px',
    backgroundColor: '#edf2f7',
    border: '1px solid #cbd5e0',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    color: '#2d3748',
  },
};
