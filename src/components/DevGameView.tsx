import React, { useEffect, useState } from 'react';
import type { CardColor, Game } from '../game/model/types';
import {
  clearPlayerSession,
  createGameInFirestore,
  executeTurnActionInFirestore,
  getPlayerSession,
  joinGameInFirestore,
  savePlayerSession,
  selectDestinationTicketsInFirestore,
  startGameInFirestore,
  subscribeToGame,
  togglePlayerReadyInFirestore,
  updatePlayerColorInFirestore,
} from '../game/services/firebase';
import { GameBoard } from './GameBoard';
import { PlayerStatus } from './PlayerStatus';
import { PlayerHand } from './PlayerHand';
import { Lobby } from './Lobby';
import { DestinationTicketModal } from './DestinationTicketModal';
import { FaceUpCards } from './FaceUpCards';
import { Scoreboard } from './Scoreboard';

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

  const handleDrawFaceUpCard = async (index: number) => {
    if (!game || !activeGameId || !localPlayerId) return;
    setErrorMessage(null);

    if (game.currentPlayerId !== localPlayerId) {
      setErrorMessage('It is not your turn!');
      return;
    }

    try {
      const updatedGame = await executeTurnActionInFirestore(activeGameId, localPlayerId, {
        type: 'DRAW_TRAIN_CARD',
        source: 'faceUp',
        index,
      });
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleDrawDeckCard = async () => {
    if (!game || !activeGameId || !localPlayerId) return;
    setErrorMessage(null);

    if (game.currentPlayerId !== localPlayerId) {
      setErrorMessage('It is not your turn!');
      return;
    }

    try {
      const updatedGame = await executeTurnActionInFirestore(activeGameId, localPlayerId, {
        type: 'DRAW_TRAIN_CARD',
        source: 'deck',
      });
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleDrawCards = async (playerId: string) => {
    if (!game || !activeGameId) return;
    setErrorMessage(null);

    if (game.currentPlayerId !== localPlayerId) {
      setErrorMessage("It is not your turn!");
      return;
    }

    try {
      const updatedGame = await executeTurnActionInFirestore(activeGameId, playerId, {
        type: 'DRAW_TRAIN_CARDS',
      });
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleDrawDestinationTickets = async (playerId: string) => {
    if (!game || !activeGameId) return;
    setErrorMessage(null);

    if (game.currentPlayerId !== localPlayerId) {
      setErrorMessage("It is not your turn!");
      return;
    }

    try {
      const updatedGame = await executeTurnActionInFirestore(activeGameId, playerId, {
        type: 'DRAW_DESTINATION_TICKETS',
      });
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleConfirmTicketSelection = async (keptTicketIds: string[]) => {
    if (!game || !activeGameId || !localPlayerId) return;
    setErrorMessage(null);

    try {
      const updatedGame = await selectDestinationTicketsInFirestore(
        activeGameId,
        localPlayerId,
        keptTicketIds
      );
      setGame(updatedGame);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  const handleClaimRoute = async (routeIdToClaim?: string) => {
    if (!game || !activeGameId) return;
    setErrorMessage(null);
    const targetRouteId = routeIdToClaim || selectedRouteId;

    if (!game.currentPlayerId) {
      setErrorMessage('No active player. Please start game first.');
      return;
    }

    if (game.currentPlayerId !== localPlayerId) {
      setErrorMessage('It is not your turn!');
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

    const localPlayer = game.players[localPlayerId];
    if (!localPlayer) {
      setErrorMessage('Local player not found.');
      return;
    }

    if (localPlayer.trainsRemaining < route.length) {
      setErrorMessage(
        `Player has only ${localPlayer.trainsRemaining} trains left but route requires ${route.length}.`
      );
      return;
    }

    let requiredColor: CardColor = selectedCardColor;
    if (route.colorRequirement !== 'any') {
      requiredColor = route.colorRequirement;
    } else {
      const colorCounts: Record<string, number> = {};
      const locoCount = localPlayer.trainCards.filter((c) => c.color === 'locomotive').length;

      localPlayer.trainCards.forEach((c) => {
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

    const matchingCards = localPlayer.trainCards.filter(
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
      const updatedGame = await executeTurnActionInFirestore(activeGameId, localPlayerId, {
        type: 'CLAIM_ROUTE',
        routeId: targetRouteId,
        cardsToUse,
      });
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

  const localPlayer = localPlayerId ? game.players[localPlayerId] : null;
  const isLocalTurn = game.currentPlayerId === localPlayerId;

  return (
    <div style={styles.container} data-testid="in-game-container">
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>Rails Between Us</h1>
            <span style={styles.subtitle}>Game #{game.gameId}</span>
          </div>
          <button style={styles.btnDangerHeader} onClick={handleLeaveGame} data-testid="leave-game-btn">
            Leave Game
          </button>
        </div>
      </header>

      {errorMessage && (
        <div style={styles.errorBox}>
          <span>{errorMessage}</span>
          <button style={styles.closeBtn} onClick={() => setErrorMessage(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Finished Game Scoreboard */}
      {(game.phase === 'finished' || game.status === 'completed') && (
        <Scoreboard game={game} onLeaveGame={handleLeaveGame} />
      )}

      {/* Pending Destination Tickets Modal */}
      {game.phase === 'playing' &&
        localPlayer?.pendingDestinationTickets &&
        localPlayer.pendingDestinationTickets.length > 0 && (
          <DestinationTicketModal
            key={localPlayer.pendingDestinationTickets.map((t) => t.id).join('-')}
            pendingTickets={localPlayer.pendingDestinationTickets}
            cities={game.boardState.cities}
            onConfirmSelection={handleConfirmTicketSelection}
            minKeep={localPlayer.pendingTicketsMinKeep ?? 1}
          />
        )}

      {/* Compact Turn Tracker */}
      <PlayerStatus
        game={game}
        localPlayerId={localPlayerId}
        section="tracker"
      />

      {/* Responsive In-Game Layout Grid */}
      <div className="game-layout">
        <div className="game-main-col">
          {/* Main Game Board */}
          <section style={styles.boardCard}>
            <GameBoard
              boardState={game.boardState}
              players={game.players}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(routeId) => {
                if (game.phase === 'finished') return;
                setErrorMessage(null);
                setSelectedRouteId(routeId);
              }}
              onClaimRoute={(routeId) => {
                if (game.phase === 'finished') return;
                handleClaimRoute(routeId);
              }}
            />
          </section>

          {/* Compact Player Summaries */}
          <PlayerStatus
            game={game}
            localPlayerId={localPlayerId}
            onDrawCards={game.phase === 'playing' ? handleDrawCards : undefined}
            onDrawDestinationTickets={game.phase === 'playing' ? handleDrawDestinationTickets : undefined}
            section="summaries"
          />
        </div>

        <div className="game-side-col">
          {/* Prominent 5 Face-Up Cards and Deck Display */}
          {game.phase === 'playing' && (
            <FaceUpCards
              faceUpCards={game.faceUpTrainCards || []}
              deckCount={game.trainCardDeck.length}
              discardCount={game.trainCardDiscardPile.length}
              cardsDrawnThisTurn={game.cardsDrawnThisTurn || 0}
              isCurrentTurn={isLocalTurn}
              onDrawFaceUpCard={handleDrawFaceUpCard}
              onDrawDeckCard={handleDrawDeckCard}
            />
          )}

          {/* Local Player Hand & Tickets */}
          {localPlayer && (
            <PlayerHand
              cards={localPlayer.trainCards}
              destinationTickets={localPlayer.destinationTickets}
              cities={game.boardState.cities}
              routes={game.boardState.routes}
              claimedRoutes={localPlayer.claimedRoutes}
              isCurrentTurn={isLocalTurn}
              selectedColor={selectedCardColor}
              onSelectColor={setSelectedCardColor}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '10px 12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#2d3748',
    backgroundColor: '#f7fafc',
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  header: {
    width: '100%',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
    color: '#1a202c',
    display: 'inline-block',
    marginRight: '8px',
  },
  subtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#718096',
  },
  btnDangerHeader: {
    padding: '5px 10px',
    backgroundColor: '#e53e3e',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  errorBox: {
    backgroundColor: '#fed7d7',
    color: '#9b2c2c',
    padding: '8px 12px',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9b2c2c',
    fontSize: '14px',
    cursor: 'pointer',
  },
  boardCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
  },
};
