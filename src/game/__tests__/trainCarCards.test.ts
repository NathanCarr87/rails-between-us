import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  checkAndRefreshFaceUpLocomotives,
  confirmDestinationTicketSelection,
  createGame,
  drawSingleTrainCard,
  executeTurnAction,
  startGame,
} from '../state/gameEngine';
import type { Game, TrainCard } from '../model/types';

function startAndConfirmGame(game: Game): Game {
  let started = startGame(game);
  for (const pid of started.playerOrder) {
    const p = started.players[pid];
    if (p && p.pendingDestinationTickets && p.pendingDestinationTickets.length > 0) {
      started = confirmDestinationTicketSelection(started, pid, p.pendingDestinationTickets.map((t) => t.id));
    }
  }
  return started;
}

describe('Train Car Card System & Drawing Rules', () => {
  it('1. Each player receives exactly 4 Train Car cards when the game starts', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    expect(game.players.p1.trainCards).toHaveLength(4);
    expect(game.players.p2.trainCards).toHaveLength(4);
  });

  it('2. Starting hands are private to the owning player', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    // Each player has their own distinct trainCards array in the game state
    const p1Hand = game.players.p1.trainCards;
    const p2Hand = game.players.p2.trainCards;

    expect(p1Hand).toBeDefined();
    expect(p2Hand).toBeDefined();

    // Verify card IDs are unique to each player's hand
    const p1CardIds = new Set(p1Hand.map((c) => c.id));
    const p2CardIds = new Set(p2Hand.map((c) => c.id));

    expect(p1CardIds.size).toBe(4);
    expect(p2CardIds.size).toBe(4);
    for (const id of p2CardIds) {
      expect(p1CardIds.has(id)).toBe(false);
    }
  });

  it('3. Five face-up cards exist after game setup', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    expect(game.faceUpTrainCards).toHaveLength(5);
  });

  it('4. Taking a face-up colored card allows a second draw', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    // Set known face-up cards with colored card at index 0
    const coloredCard: TrainCard = { id: 'face_red_1', color: 'red' };
    game.faceUpTrainCards[0] = coloredCard;

    expect(game.currentPlayerId).toBe('p1');

    // First draw: face-up colored card
    game = drawSingleTrainCard(game, 'p1', 'faceUp', 0);

    expect(game.players.p1.trainCards).toHaveLength(5);
    expect(game.cardsDrawnThisTurn).toBe(1);
    expect(game.currentPlayerId).toBe('p1'); // Turn has not ended yet

    // Second draw: blind card from deck
    game = drawSingleTrainCard(game, 'p1', 'deck');

    expect(game.players.p1.trainCards).toHaveLength(6);
    expect(game.currentPlayerId).toBe('p2'); // Turn advanced to p2
  });

  it('5. Taking a face-up Locomotive ends the draw action immediately', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    // Place locomotive at face-up index 0
    const locoCard: TrainCard = { id: 'face_loco_1', color: 'locomotive' };
    game.faceUpTrainCards[0] = locoCard;

    expect(game.currentPlayerId).toBe('p1');

    // Drawing face-up locomotive as 1st card ends action immediately
    game = drawSingleTrainCard(game, 'p1', 'faceUp', 0);

    expect(game.players.p1.trainCards).toContainEqual(locoCard);
    expect(game.players.p1.trainCards).toHaveLength(5);
    expect(game.currentPlayerId).toBe('p2'); // Turn ended and advanced to p2
  });

  it('6. Drawing a Locomotive blindly does not end the draw action', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    // Place locomotive at top of train card deck
    const locoDeckCard: TrainCard = { id: 'deck_loco_1', color: 'locomotive' };
    game.trainCardDeck.push(locoDeckCard);

    expect(game.currentPlayerId).toBe('p1');

    // Drawing a blind locomotive from deck
    game = drawSingleTrainCard(game, 'p1', 'deck');

    expect(game.players.p1.trainCards).toContainEqual(locoDeckCard);
    expect(game.cardsDrawnThisTurn).toBe(1);
    expect(game.currentPlayerId).toBe('p1'); // Action does NOT end; p1 gets 2nd draw
  });

  it('7. Taking a face-up card replaces it from the deck', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    const replacementCard: TrainCard = { id: 'top_deck_card_1', color: 'blue' };
    game.trainCardDeck.push(replacementCard);

    const oldFaceUpCard = game.faceUpTrainCards[2];

    game = drawSingleTrainCard(game, 'p1', 'faceUp', 2);

    expect(game.players.p1.trainCards).toContainEqual(oldFaceUpCard);
    expect(game.faceUpTrainCards[2]).toEqual(replacementCard);
    expect(game.faceUpTrainCards).toHaveLength(5);
  });

  it('8. Three or more face-up Locomotives causes all five face-up cards to refresh', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    // Create face-up state with 3 locomotives
    const loco1: TrainCard = { id: 'l1', color: 'locomotive' };
    const loco2: TrainCard = { id: 'l2', color: 'locomotive' };
    const loco3: TrainCard = { id: 'l3', color: 'locomotive' };
    const red1: TrainCard = { id: 'r1', color: 'red' };
    const blue1: TrainCard = { id: 'b1', color: 'blue' };

    game.faceUpTrainCards = [loco1, loco2, loco3, red1, blue1];

    // Ensure replacement cards from deck are non-locomotives to avoid multi-loop shuffle
    game.trainCardDeck = game.trainCardDeck.map((c) => ({ ...c, color: 'red' }));

    const initialDiscardLength = game.trainCardDiscardPile.length;

    // Run locomotive refresh check
    game = checkAndRefreshFaceUpLocomotives(game);

    // Old 5 face-up cards should be moved to discard pile
    expect(game.trainCardDiscardPile.length).toBe(initialDiscardLength + 5);
    expect(game.faceUpTrainCards).toHaveLength(5);

    // Refreshed face-up cards should have fewer than 3 locomotives
    const newLocoCount = game.faceUpTrainCards.filter((c) => c.color === 'locomotive').length;
    expect(newLocoCount).toBeLessThan(3);
  });

  it('9. Only the current player can draw', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    expect(game.currentPlayerId).toBe('p1');

    // Attempting to draw as p2 when it is p1's turn throws an error
    expect(() => {
      drawSingleTrainCard(game, 'p2', 'deck');
    }).toThrow(/Not player p2's turn/i);

    expect(() => {
      executeTurnAction(game, 'p2', { type: 'DRAW_TRAIN_CARD', source: 'deck' });
    }).toThrow(/Not player p2's turn/i);
  });

  it('10. Deck, discard pile, face-up cards, and player hands remain consistent after draws', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    function getTotalCardCount(g: Game): number {
      const p1Cards = g.players.p1.trainCards.length;
      const p2Cards = g.players.p2.trainCards.length;
      return (
        g.trainCardDeck.length +
        g.faceUpTrainCards.length +
        g.trainCardDiscardPile.length +
        p1Cards +
        p2Cards
      );
    }

    const totalBefore = getTotalCardCount(game);
    expect(totalBefore).toBe(110);

    // Perform p1 turn (2 blind draws)
    game = drawSingleTrainCard(game, 'p1', 'deck');
    game = drawSingleTrainCard(game, 'p1', 'deck');
    expect(getTotalCardCount(game)).toBe(110);

    // Perform p2 turn (1 face-up colored card + 1 deck card)
    // Ensure index 0 is non-locomotive
    game.faceUpTrainCards[0] = { id: 'test_col_1', color: 'green' };
    game = drawSingleTrainCard(game, 'p2', 'faceUp', 0);
    game = drawSingleTrainCard(game, 'p2', 'deck');
    expect(getTotalCardCount(game)).toBe(110);

    // Check card uniqueness
    const allCards: TrainCard[] = [
      ...game.trainCardDeck,
      ...game.faceUpTrainCards,
      ...game.trainCardDiscardPile,
      ...game.players.p1.trainCards,
      ...game.players.p2.trainCards,
    ];

    const uniqueCardIds = new Set(allCards.map((c) => c.id));
    expect(uniqueCardIds.size).toBe(110);
  });
});
