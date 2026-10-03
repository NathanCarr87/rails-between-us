import React, { useState } from 'react';
import type { CardColor, Game } from '../game/model/types';
import {
  addPlayer,
  advanceTurn,
  claimRoute,
  createGame,
  drawTrainCards,
  MAX_PLAYERS,
} from '../game/state/gameEngine';
import { GameBoard } from './GameBoard';
import { PlayerStatus } from './PlayerStatus';

const PLAYER_COLORS = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#dd6b20'];

export const DevGameView: React.FC = () => {
  const [game, setGame] = useState<Game>(() => createGame('dev_game_1'));
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedCardColor, setSelectedCardColor] = useState<CardColor>('red');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = () => {
    setGame(createGame('dev_game_' + Date.now()));
    setSelectedRouteId('');
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

  const handleClaimRoute = (routeIdToClaim?: string) => {
    setErrorMessage(null);
    const targetRouteId = routeIdToClaim || selectedRouteId;

    if (!game.currentPlayerId) {
      setErrorMessage('No active player. Please add players first.');
      return;
    }
    if (!targetRouteId) {
      setErrorMessage('Select a route to claim.');
      return;
    }

    const route = game.boardState.routes[targetRouteId];
    if (!route) {
      setErrorMessage('Invalid route.');
      return;
    }

    if (route.ownerPlayerId) {
      setErrorMessage('Route is already claimed.');
      return;
    }

    const currentPlayer = game.players[game.currentPlayerId];
    if (!currentPlayer) {
      setErrorMessage('Current player not found.');
      return;
    }

    if (currentPlayer.trainsRemaining < route.length) {
      setErrorMessage(
        `Player has only ${currentPlayer.trainsRemaining} trains left but route requires ${route.length}.`
      );
      return;
    }

    // Determine card color to use for the route
    let requiredColor: CardColor = selectedCardColor;
    if (route.colorRequirement !== 'any') {
      requiredColor = route.colorRequirement;
    } else {
      // If specific card color selected has enough cards, use it; otherwise find a color with enough cards in hand
      const colorCounts: Record<string, number> = {};
      const locoCount = currentPlayer.trainCards.filter((c) => c.color === 'locomotive').length;

      currentPlayer.trainCards.forEach((c) => {
        if (c.color !== 'locomotive') {
          colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }
      });

      if ((colorCounts[selectedCardColor] || 0) + locoCount >= route.length) {
        requiredColor = selectedCardColor;
      } else {
        // Find any color that meets the route length requirement
        const suitableColor = Object.keys(colorCounts).find(
          (col) => (colorCounts[col] || 0) + locoCount >= route.length
        );
        if (suitableColor) {
          requiredColor = suitableColor as CardColor;
        } else if (locoCount >= route.length) {
          requiredColor = 'locomotive';
        } else {
          requiredColor = selectedCardColor;
        }
      }
    }

    // Find cards matching requiredColor or locomotive
    const matchingCards = currentPlayer.trainCards.filter(
      (c) => c.color === requiredColor || c.color === 'locomotive'
    );

    if (matchingCards.length < route.length) {
      setErrorMessage(
        `Player has only ${matchingCards.length} ${requiredColor}/locomotive card(s) but route requires ${route.length}.`
      );
      return;
    }

    const cardsToUse = matchingCards.slice(0, route.length);

    try {
      const updatedGame = claimRoute(game, game.currentPlayerId, targetRouteId, cardsToUse);
      setGame(updatedGame);
      setSelectedRouteId('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const currentPlayer = game.currentPlayerId ? game.players[game.currentPlayerId] : null;
  const selectedRoute = selectedRouteId ? game.boardState.routes[selectedRouteId] : null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Rails Between Us</h1>
        <p style={styles.subtitle}>USA Game Board View</p>
      </header>

      {errorMessage && (
        <div style={styles.errorBox}>
          <span>{errorMessage}</span>
          <button style={styles.closeBtn} onClick={() => setErrorMessage(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Status Area */}
      <PlayerStatus game={game} onDrawCards={handleDrawCards} />

      {/* Main Game Board */}
      <section style={styles.boardCard}>
        <GameBoard
          boardState={game.boardState}
          players={game.players}
          selectedRouteId={selectedRouteId}
          onSelectRoute={(routeId) => {
            setErrorMessage(null);
            setSelectedRouteId(routeId);
          }}
          onClaimRoute={(routeId) => handleClaimRoute(routeId)}
        />
      </section>

      {/* Control Panel / Actions */}
      <div style={styles.controlGrid}>
        {/* Add Player Box */}
        <section style={styles.card}>
          <h3>Add Players</h3>
          {game.playerOrder.length < MAX_PLAYERS ? (
            <form onSubmit={handleAddPlayer} style={styles.formRow}>
              <input
                type="text"
                placeholder="Player name..."
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.btnSuccess}>
                + Add
              </button>
            </form>
          ) : (
            <p style={styles.mutedText}>Max players reached ({MAX_PLAYERS}).</p>
          )}

          <div style={styles.btnRow}>
            <button
              style={styles.btnPrimary}
              onClick={handleAdvanceTurn}
              disabled={game.playerOrder.length === 0}
            >
              Advance Turn
            </button>
            <button style={styles.btnDanger} onClick={handleReset}>
              Reset Game
            </button>
          </div>
        </section>

        {/* Route Claiming Box */}
        <section style={styles.card}>
          <h3>Claim Route</h3>
          {currentPlayer ? (
            <div style={styles.actionBox}>
              <div style={styles.formGroup}>
                <label>Selected Route: </label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  style={styles.select}
                  data-testid="route-select-dropdown"
                >
                  <option value="">-- Click on map or choose route --</option>
                  {Object.values(game.boardState.routes).map((r) => {
                    const cityA = game.boardState.cities[r.cityA]?.name || r.cityA;
                    const cityB = game.boardState.cities[r.cityB]?.name || r.cityB;
                    const owner = r.ownerPlayerId
                      ? game.players[r.ownerPlayerId]?.displayName
                      : 'Unclaimed';
                    return (
                      <option key={r.routeId} value={r.routeId} disabled={r.ownerPlayerId !== null}>
                        {cityA} ↔ {cityB} (Len: {r.length}, Req: {r.colorRequirement}) - [{owner}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedRoute && (
                <div style={styles.selectedRouteInfo} data-testid="selected-route-info">
                  <strong>Selected:</strong> {game.boardState.cities[selectedRoute.cityA]?.name} ↔{' '}
                  {game.boardState.cities[selectedRoute.cityB]?.name} | Length: {selectedRoute.length} |
                  Color: {selectedRoute.colorRequirement}
                </div>
              )}

              <div style={styles.formGroup}>
                <label>Select Card Color to Pay: </label>
                <select
                  value={selectedCardColor}
                  onChange={(e) => setSelectedCardColor(e.target.value as CardColor)}
                  style={styles.select}
                >
                  {['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'].map(
                    (col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    )
                  )}
                </select>
              </div>

              <button
                style={styles.btnPrimary}
                onClick={() => handleClaimRoute()}
                data-testid="claim-route-control-btn"
              >
                Claim Selected Route
              </button>
            </div>
          ) : (
            <p style={styles.mutedText}>Add players to start claiming routes.</p>
          )}
        </section>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#2d3748',
    backgroundColor: '#f7fafc',
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    textAlign: 'center',
  },
  title: {
    fontSize: '26px',
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
    padding: '12px 16px',
    borderRadius: '8px',
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
  boardCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  controlGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
  selectedRouteInfo: {
    padding: '8px',
    backgroundColor: '#ebf8ff',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#2b6cb0',
  },
  mutedText: {
    color: '#718096',
    fontSize: '14px',
  },
};
