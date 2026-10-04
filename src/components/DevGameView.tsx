import React, { useEffect, useState } from 'react';
import type { CardColor, Game } from '../game/model/types';
import {
  advanceTurn,
  claimRoute,
  drawTrainCards,
} from '../game/state/gameEngine';
import {
  clearPlayerSession,
  createGameInFirestore,
  getPlayerSession,
  joinGameInFirestore,
  savePlayerSession,
  startGameInFirestore,
  subscribeToGame,
  togglePlayerReadyInFirestore,
  updatePlayerColorInFirestore,
} from '../game/services/firebase';
import { GameBoard } from './GameBoard';
import { PlayerStatus } from './PlayerStatus';
import { Lobby } from './Lobby';

export const DevGameView: React.FC = () => {
  const [activeGameId, setActiveGameId] = useState<string>(() => {
    const session = getPlayerSession();
    return session?.gameId || '';
  });
  const [localPlayerId, setLocalPlayerId] = useState<string>(() => {
    const session = getPlayerSession();
    return session?.playerId || '';
  });
  const [game, setGame] = useState<Game | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedCardColor, setSelectedCardColor] = useState<CardColor>('red');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to real-time updates whenever activeGameId changes
  useEffect(() => {
    if (!activeGameId) return;

    const unsubscribe = subscribeToGame(
      activeGameId,
      (updatedGame) => {
        if (!updatedGame) {
          clearPlayerSession(activeGameId);
          setGame(null);
          setActiveGameId('');
          setErrorMessage(`Game ${activeGameId} does not exist.`);
        } else {
          setGame(updatedGame);
        }
      },
      (err) => {
        setErrorMessage(err.message || 'Error subscribing to game updates.');
      }
    );

    return () => unsubscribe();
  }, [activeGameId]);

  const handleCreateGame = async (gameId: string, playerName: string, color: string) => {
    setErrorMessage(null);
    try {
      const pid = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newGame = await createGameInFirestore(gameId, {
        playerId: pid,
        displayName: playerName,
        color,
      });

      savePlayerSession(gameId, pid, playerName);
      setLocalPlayerId(pid);
      setActiveGameId(gameId);
      setGame(newGame);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error creating game');
    }
  };

  const handleJoinGame = async (gameId: string, playerName: string, color: string) => {
    setErrorMessage(null);
    try {
      const existingSession = getPlayerSession(gameId);
      const pid = existingSession?.playerId || `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const updatedGame = await joinGameInFirestore(gameId, {
        playerId: pid,
        displayName: playerName,
        color,
      });

      savePlayerSession(gameId, pid, playerName);
      setLocalPlayerId(pid);
      setActiveGameId(gameId);
      setGame(updatedGame);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error joining game');
    }
  };

  const handleSelectColor = async (color: string) => {
    if (!activeGameId || !localPlayerId) return;
    setErrorMessage(null);
    try {
      const updatedGame = await updatePlayerColorInFirestore(activeGameId, localPlayerId, color);
      setGame(updatedGame);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error selecting color');
    }
  };

  const handleToggleReady = async () => {
    if (!activeGameId || !localPlayerId) return;
    setErrorMessage(null);
    try {
      const updatedGame = await togglePlayerReadyInFirestore(activeGameId, localPlayerId);
      setGame(updatedGame);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error toggling ready');
    }
  };

  const handleStartGame = async () => {
    if (!activeGameId) return;
    setErrorMessage(null);
    try {
      const updatedGame = await startGameInFirestore(activeGameId);
      setGame(updatedGame);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error starting game');
    }
  };

  const handleLeaveGame = () => {
    clearPlayerSession(activeGameId);
    setGame(null);
    setActiveGameId('');
    setLocalPlayerId('');
    setSelectedRouteId('');
    setErrorMessage(null);
  };

  const handleAdvanceTurn = () => {
    if (!game) return;
    setErrorMessage(null);
    setGame(advanceTurn(game));
  };

  const handleDrawCards = (playerId: string) => {
    if (!game) return;
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
    if (!game) return;
    setErrorMessage(null);
    const targetRouteId = routeIdToClaim || selectedRouteId;

    if (!game.currentPlayerId) {
      setErrorMessage('No active player. Please start game first.');
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

    let requiredColor: CardColor = selectedCardColor;
    if (route.colorRequirement !== 'any') {
      requiredColor = route.colorRequirement;
    } else {
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

  // Render Lobby screen if no active game or if game.phase is 'lobby'
  if (!game || game.phase === 'lobby') {
    return (
      <Lobby
        game={game}
        localPlayerId={localPlayerId}
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        onSelectColor={handleSelectColor}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartGame}
        onLeaveGame={handleLeaveGame}
        errorMessage={errorMessage}
      />
    );
  }

  const currentPlayer = game.currentPlayerId ? game.players[game.currentPlayerId] : null;

  return (
    <div style={styles.container} data-testid="in-game-container">
      <header style={styles.header}>
        <h1 style={styles.title}>Rails Between Us</h1>
        <p style={styles.subtitle}>USA Game Board — In-Game ({game.gameId})</p>
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
        {/* Controls / Turn Info */}
        <section style={styles.card}>
          <h3>Game Controls</h3>
          <p style={styles.mutedText}>
            Active Player:{' '}
            <strong>{currentPlayer ? currentPlayer.displayName : 'None'}</strong>
          </p>

          <div style={styles.btnRow}>
            <button
              style={styles.btnPrimary}
              onClick={handleAdvanceTurn}
              disabled={game.playerOrder.length === 0}
            >
              Advance Turn
            </button>
            <button style={styles.btnDanger} onClick={handleLeaveGame}>
              Return to Lobby
            </button>
          </div>
        </section>

        {/* Payment Card Color Selection for Board Route Claiming */}
        <section style={styles.card}>
          <h3>Route Claim Settings</h3>
          {currentPlayer ? (
            <div style={styles.actionBox}>
              <div style={styles.formGroup}>
                <label>Card Color to Pay for 'Any' Color Routes: </label>
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
              <p style={styles.mutedText}>
                Click routes directly on the board to claim them.
              </p>
            </div>
          ) : (
            <p style={styles.mutedText}>No active player.</p>
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
  mutedText: {
    color: '#718096',
    fontSize: '14px',
  },
};
