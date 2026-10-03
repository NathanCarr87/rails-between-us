import React, { useState } from 'react';
import type { Game, CardColor } from '../game/model/types';
import {
  addPlayer,
  advanceTurn,
  claimRoute,
  createGame,
  drawTrainCards,
  MAX_PLAYERS,
} from '../game/state/gameEngine';

const PLAYER_COLORS = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#dd6b20'];

export const DevGameView: React.FC = () => {
  const [game, setGame] = useState<Game>(() => createGame('dev_game_1'));
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedCardColor, setSelectedCardColor] = useState<CardColor>('red');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = () => {
    setGame(createGame('dev_game_' + Date.now()));
    setErrorMessage(null);
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const name = newPlayerName.trim() || `Player ${game.playerOrder.length + 1}`;
    const playerId = `player_${Date.now()}_${game.playerOrder.length + 1}`;
    const color = PLAYER_COLORS[game.playerOrder.length % PLAYER_COLORS.length];

    try {
      const updatedGame = addPlayer(game, {
        playerId,
        displayName: name,
        color,
      });
      setGame(updatedGame);
      setNewPlayerName('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An error occurred adding player.');
      }
    }
  };

  const handleAdvanceTurn = () => {
    setErrorMessage(null);
    setGame(advanceTurn(game));
  };

  const handleDrawCards = (playerId: string) => {
    setErrorMessage(null);
    try {
      const updatedGame = drawTrainCards(game, playerId, 2);
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleClaimRoute = () => {
    setErrorMessage(null);
    if (!game.currentPlayerId) {
      setErrorMessage('No active player.');
      return;
    }
    if (!selectedRouteId) {
      setErrorMessage('Select a route to claim.');
      return;
    }

    const route = game.boardState.routes[selectedRouteId];
    if (!route) {
      setErrorMessage('Invalid route.');
      return;
    }

    const currentPlayer = game.players[game.currentPlayerId];
    if (!currentPlayer) {
      setErrorMessage('Current player not found.');
      return;
    }

    // Find cards matching the selected card color (or locomotive)
    const matchingCards = currentPlayer.trainCards.filter(
      (c) => c.color === selectedCardColor || c.color === 'locomotive'
    );

    if (matchingCards.length < route.length) {
      setErrorMessage(
        `Player has only ${matchingCards.length} ${selectedCardColor}/locomotive card(s) but route requires ${route.length}.`
      );
      return;
    }

    const cardsToUse = matchingCards.slice(0, route.length);

    try {
      const updatedGame = claimRoute(game, game.currentPlayerId, selectedRouteId, cardsToUse);
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const currentPlayer = game.currentPlayerId ? game.players[game.currentPlayerId] : null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Railway Dev Game View</h1>
        <p style={styles.subtitle}>Domain Model Tester (Mobile-Friendly)</p>
      </header>

      {errorMessage && (
        <div style={styles.errorBox}>
          <span>{errorMessage}</span>
          <button style={styles.closeBtn} onClick={() => setErrorMessage(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Game Meta & Controls */}
      <section style={styles.card}>
        <h2>Game Info</h2>
        <div style={styles.grid2}>
          <div><strong>Game ID:</strong> {game.gameId}</div>
          <div><strong>Status:</strong> <span style={styles.badge}>{game.status}</span></div>
          <div><strong>Turn Number:</strong> {game.turnNumber}</div>
          <div><strong>Current Player:</strong> {currentPlayer?.displayName ?? 'None'}</div>
          <div><strong>Deck Cards Left:</strong> {game.trainCardDeck.length}</div>
          <div><strong>Discard Pile:</strong> {game.trainCardDiscardPile.length}</div>
        </div>

        <div style={styles.btnRow}>
          <button style={styles.btnPrimary} onClick={handleAdvanceTurn} disabled={game.playerOrder.length === 0}>
            Advance Turn
          </button>
          <button style={styles.btnDanger} onClick={handleReset}>
            Reset Game
          </button>
        </div>
      </section>

      {/* Player Management */}
      <section style={styles.card}>
        <h2>Players ({game.playerOrder.length}/{MAX_PLAYERS})</h2>

        {game.playerOrder.length < MAX_PLAYERS && (
          <form onSubmit={handleAddPlayer} style={styles.formRow}>
            <input
              type="text"
              placeholder="Player name..."
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.btnSuccess}>
              + Add Player
            </button>
          </form>
        )}

        <div style={styles.playerList}>
          {game.playerOrder.map((pid) => {
            const p = game.players[pid];
            const isCurrent = pid === game.currentPlayerId;
            return (
              <div
                key={pid}
                style={{
                  ...styles.playerCard,
                  borderColor: p.color,
                  backgroundColor: isCurrent ? '#f0fff4' : '#ffffff',
                }}
              >
                <div style={styles.playerHeader}>
                  <span style={{ ...styles.colorDot, backgroundColor: p.color }} />
                  <strong>{p.displayName}</strong> {isCurrent && <span style={styles.turnIndicator}>(Current Turn)</span>}
                </div>
                <div style={styles.playerStats}>
                  <div>Score: <strong>{p.score}</strong></div>
                  <div>Trains Left: <strong>{p.trainsRemaining}</strong></div>
                  <div>Cards in Hand: <strong>{p.trainCards.length}</strong></div>
                  <div>Claimed Routes: <strong>{p.claimedRoutes.length}</strong></div>
                </div>

                <div style={styles.handCards}>
                  <small>Cards: </small>
                  {p.trainCards.length === 0 ? (
                    <em>None</em>
                  ) : (
                    p.trainCards.map((c, idx) => (
                      <span key={idx} style={{ ...styles.cardTag, backgroundColor: getCardTagBg(c.color) }}>
                        {c.color}
                      </span>
                    ))
                  )}
                </div>

                <div style={{ marginTop: '8px' }}>
                  <button
                    style={styles.btnSmall}
                    onClick={() => handleDrawCards(pid)}
                    disabled={game.trainCardDeck.length + game.trainCardDiscardPile.length === 0}
                  >
                    Draw 2 Train Cards
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Routes & Actions */}
      <section style={styles.card}>
        <h2>Claim Route Action</h2>
        {currentPlayer ? (
          <div style={styles.actionBox}>
            <p>
              Claim route for <strong>{currentPlayer.displayName}</strong>
            </p>
            <div style={styles.formGroup}>
              <label>Select Route: </label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                style={styles.select}
              >
                <option value="">-- Choose Route --</option>
                {Object.values(game.boardState.routes).map((r) => {
                  const cityA = game.boardState.cities[r.cityA]?.name || r.cityA;
                  const cityB = game.boardState.cities[r.cityB]?.name || r.cityB;
                  const owner = r.ownerPlayerId ? game.players[r.ownerPlayerId]?.displayName : 'Unclaimed';
                  return (
                    <option key={r.routeId} value={r.routeId} disabled={r.ownerPlayerId !== null}>
                      {cityA} ↔ {cityB} (Length {r.length}, Color {r.colorRequirement}) - [{owner}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label>Select Card Color to Pay: </label>
              <select
                value={selectedCardColor}
                onChange={(e) => setSelectedCardColor(e.target.value as CardColor)}
                style={styles.select}
              >
                {['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'].map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <button style={styles.btnPrimary} onClick={handleClaimRoute}>
              Claim Route
            </button>
          </div>
        ) : (
          <p>Add at least 2 players to start claiming routes.</p>
        )}
      </section>

      {/* Board State View */}
      <section style={styles.card}>
        <h2>Board Routes State</h2>
        <div style={styles.routeGrid}>
          {Object.values(game.boardState.routes).map((r) => {
            const cityA = game.boardState.cities[r.cityA]?.name || r.cityA;
            const cityB = game.boardState.cities[r.cityB]?.name || r.cityB;
            const owner = r.ownerPlayerId ? game.players[r.ownerPlayerId] : null;

            return (
              <div key={r.routeId} style={styles.routeCard}>
                <div>
                  <strong>{cityA}</strong> ↔ <strong>{cityB}</strong>
                </div>
                <div style={styles.routeDetails}>
                  <span>Length: {r.length}</span> | <span>Req: {r.colorRequirement}</span>
                </div>
                <div>
                  Owner:{' '}
                  {owner ? (
                    <span style={{ color: owner.color, fontWeight: 'bold' }}>{owner.displayName}</span>
                  ) : (
                    <em>None</em>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

function getCardTagBg(color: string): string {
  switch (color) {
    case 'red':
      return '#feb2b2';
    case 'blue':
      return '#bee3f8';
    case 'green':
      return '#c6f6d5';
    case 'yellow':
      return '#fefcbf';
    case 'purple':
      return '#e9d8fd';
    case 'orange':
      return '#fbd38d';
    case 'black':
      return '#cbd5e0';
    case 'white':
      return '#edf2f7';
    case 'locomotive':
      return '#e2e8f0';
    default:
      return '#e2e8f0';
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#2d3748',
    backgroundColor: '#f7fafc',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '16px',
  },
  title: {
    fontSize: '22px',
    margin: '0 0 4px 0',
    color: '#1a202c',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#718096',
  },
  errorBox: {
    backgroundColor: '#fed7d7',
    color: '#9b2c2c',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9b2c2c',
    fontSize: '16px',
    cursor: 'pointer',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    fontSize: '14px',
    marginBottom: '12px',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#e2e8f0',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  btnRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  btnPrimary: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '10px 16px',
    backgroundColor: '#e53e3e',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnSuccess: {
    padding: '8px 12px',
    backgroundColor: '#38a169',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnSmall: {
    padding: '6px 10px',
    backgroundColor: '#edf2f7',
    border: '1px solid #cbd5e0',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  formRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e0',
    fontSize: '14px',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  playerCard: {
    border: '2px solid #cbd5e0',
    borderRadius: '8px',
    padding: '12px',
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
    display: 'inline-block',
  },
  turnIndicator: {
    color: '#38a169',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  playerStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
    fontSize: '13px',
    color: '#4a5568',
    marginBottom: '8px',
  },
  handCards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
    fontSize: '12px',
  },
  cardTag: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid rgba(0,0,0,0.1)',
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '14px',
  },
  select: {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #cbd5e0',
    fontSize: '14px',
  },
  routeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  routeCard: {
    padding: '10px',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
  },
  routeDetails: {
    color: '#718096',
    margin: '4px 0',
  },
};
