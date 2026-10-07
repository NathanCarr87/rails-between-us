import React from 'react';
import type { Game } from '../game/model/types';
import { isTicketCompleted } from '../game/state/gameEngine';

export interface ScoreboardProps {
  game: Game;
  onLeaveGame?: () => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ game, onLeaveGame }) => {
  const sortedPlayers = [...game.playerOrder]
    .map((pid) => game.players[pid])
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => b.score - a.score);

  const winner = sortedPlayers[0];

  return (
    <div style={styles.container} data-testid="finished-game-scoreboard">
      <header style={styles.header}>
        <h1 style={styles.title} data-testid="scoreboard-title">Game Over - Final Results</h1>
        {winner && (
          <p style={styles.winnerAnnounce} data-testid="winner-announcement">
            🏆 <strong>{winner.displayName}</strong> wins with <strong>{winner.score}</strong> points!
          </p>
        )}
      </header>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>Rank</th>
              <th style={styles.th}>Player</th>
              <th style={styles.th}>Route Points</th>
              <th style={styles.th}>Ticket Points</th>
              <th style={styles.th}>Longest Path Bonus</th>
              <th style={styles.th}>Final Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, index) => {
              const breakdown = player.scoreBreakdown || {
                routePoints: 0,
                destinationTicketPoints: 0,
                longestPathLength: 0,
                longestPathBonus: 0,
                finalScore: player.score,
              };

              return (
                <React.Fragment key={player.playerId}>
                  <tr
                    style={{
                      ...styles.tr,
                      backgroundColor: index === 0 ? '#f0fff4' : '#ffffff',
                    }}
                    data-testid={`player-score-row-${player.playerId}`}
                  >
                    <td style={styles.td}>#{index + 1}</td>
                    <td style={styles.td}>
                      <div style={styles.playerInfo}>
                        <span style={{ ...styles.colorDot, backgroundColor: player.color }} />
                        <span style={styles.playerName}>{player.displayName}</span>
                      </div>
                    </td>
                    <td style={styles.td} data-testid={`route-points-${player.playerId}`}>
                      {breakdown.routePoints} pts
                    </td>
                    <td style={styles.td} data-testid={`ticket-points-${player.playerId}`}>
                      {breakdown.destinationTicketPoints >= 0 ? '+' : ''}
                      {breakdown.destinationTicketPoints} pts
                    </td>
                    <td style={styles.td} data-testid={`longest-path-bonus-${player.playerId}`}>
                      {breakdown.longestPathBonus > 0 ? (
                        <span style={styles.bonusBadge}>+10 pts ({breakdown.longestPathLength} train path)</span>
                      ) : (
                        <span>0 pts ({breakdown.longestPathLength} train path)</span>
                      )}
                    </td>
                    <td style={styles.tdBold} data-testid={`final-score-${player.playerId}`}>
                      {player.score} pts
                    </td>
                  </tr>

                  {/* Revealed Destination Tickets for this player */}
                  <tr style={styles.ticketDetailsRow}>
                    <td colSpan={6} style={styles.ticketDetailsTd}>
                      <div style={styles.ticketsContainer} data-testid={`revealed-tickets-${player.playerId}`}>
                        <strong>Destination Tickets:</strong>
                        {player.destinationTickets.length === 0 ? (
                          <span style={styles.muted}> None</span>
                        ) : (
                          <ul style={styles.ticketList}>
                            {player.destinationTickets.map((ticket) => {
                              const completed = isTicketCompleted(
                                ticket,
                                player.claimedRoutes,
                                game.boardState.routes
                              );
                              const cityA = game.boardState.cities[ticket.cityA]?.name || ticket.cityA;
                              const cityB = game.boardState.cities[ticket.cityB]?.name || ticket.cityB;

                              return (
                                <li
                                  key={ticket.id}
                                  style={{
                                    ...styles.ticketItem,
                                    borderColor: completed ? '#38a169' : '#e53e3e',
                                    backgroundColor: completed ? '#f0fff4' : '#fff5f5',
                                  }}
                                  data-testid={`ticket-status-${ticket.id}`}
                                >
                                  <span>
                                    {cityA} ↔ {cityB} ({ticket.points} pts)
                                  </span>
                                  <span style={{ color: completed ? '#276749' : '#9b2c2c', fontWeight: 'bold' }}>
                                    {completed ? `Completed (+${ticket.points})` : `Incomplete (-${ticket.points})`}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {onLeaveGame && (
        <div style={styles.actionRow}>
          <button style={styles.btnPrimary} onClick={onLeaveGame} data-testid="return-lobby-btn">
            Return to Lobby
          </button>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    color: '#1a202c',
  },
  winnerAnnounce: {
    fontSize: '18px',
    margin: 0,
    color: '#2b6cb0',
  },
  tableCard: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '14px',
  },
  tableHeaderRow: {
    backgroundColor: '#edf2f7',
    borderBottom: '2px solid #cbd5e0',
  },
  th: {
    padding: '12px',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  tr: {
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '12px',
    color: '#4a5568',
  },
  tdBold: {
    padding: '12px',
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#2b6cb0',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  colorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  playerName: {
    fontWeight: 'bold',
    color: '#1a202c',
  },
  bonusBadge: {
    color: '#276749',
    fontWeight: 'bold',
  },
  ticketDetailsRow: {
    borderBottom: '2px solid #cbd5e0',
    backgroundColor: '#f7fafc',
  },
  ticketDetailsTd: {
    padding: '8px 12px 16px 12px',
  },
  ticketsContainer: {
    fontSize: '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  ticketList: {
    margin: '4px 0 0 0',
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '8px',
  },
  ticketItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '12px',
  },
  muted: {
    color: '#a0aec0',
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '12px',
  },
  btnPrimary: {
    padding: '12px 24px',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
  },
};
