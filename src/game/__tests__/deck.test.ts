import { describe, expect, it } from 'vitest';
import {
  createStandardTrainDeck,
  STANDARD_TRAIN_COLORS,
} from '../rules/defaults';
import {
  addPlayer,
  createGame,
  discardTrainCards,
  drawTrainCards,
} from '../state/gameEngine';
import type { Game, TrainCard } from '../model/types';

describe('Standard Train Card Deck & Operations', () => {
  it('has total deck size of 110 cards when created', () => {
    const deck = createStandardTrainDeck(false);
    expect(deck).toHaveLength(110);
  });

  it('contains exactly 12 cards of each standard color', () => {
    const deck = createStandardTrainDeck(false);

    for (const color of STANDARD_TRAIN_COLORS) {
      const colorCards = deck.filter((card) => card.color === color);
      expect(colorCards).toHaveLength(12);
    }
  });

  it('contains exactly 14 locomotive cards', () => {
    const deck = createStandardTrainDeck(false);
    const locomotives = deck.filter((card) => card.color === 'locomotive');
    expect(locomotives).toHaveLength(14);
  });

  it('creates a shuffled deck when shuffle flag is true', () => {
    const unshuffled = createStandardTrainDeck(false);
    const shuffled = createStandardTrainDeck(true);

    expect(shuffled).toHaveLength(110);
    // Unique card IDs are preserved
    const unshuffledIds = unshuffled.map((c) => c.id).sort();
    const shuffledIds = shuffled.map((c) => c.id).sort();
    expect(shuffledIds).toEqual(unshuffledIds);

    // Order should differ from unshuffled deck
    const isDifferentOrder = shuffled.some((card, idx) => card.id !== unshuffled[idx].id);
    expect(isDifferentOrder).toBe(true);
  });

  it('allows players to draw cards from the deck', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    expect(game.trainCardDeck).toHaveLength(110);
    expect(game.players.p1.trainCards).toHaveLength(0);

    game = drawTrainCards(game, 'p1', 2);

    expect(game.trainCardDeck).toHaveLength(108);
    expect(game.players.p1.trainCards).toHaveLength(2);
  });

  it('reshuffles discard pile into deck when deck is empty and preserves card data and locomotives', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    // Empty the deck and put cards in discard pile including standard colors and locomotive
    const discardPile: TrainCard[] = [
      { id: 'card_discard_1', color: 'red' },
      { id: 'card_discard_2', color: 'blue' },
      { id: 'card_discard_3', color: 'locomotive' },
    ];

    game = {
      ...game,
      trainCardDeck: [],
      trainCardDiscardPile: discardPile,
    };

    game = drawTrainCards(game, 'p1', 2);

    // Player drew 2 recycled cards
    expect(game.players.p1.trainCards).toHaveLength(2);
    // 3 discarded cards - 2 drawn = 1 remaining in deck
    expect(game.trainCardDeck).toHaveLength(1);
    // Discard pile must be completely emptied so cards do not exist in both piles
    expect(game.trainCardDiscardPile).toHaveLength(0);

    // Verify all 3 cards in game (drawn + remaining deck) are exact original cards
    const allCards = [...game.players.p1.trainCards, ...game.trainCardDeck];
    expect(allCards.map((c) => c.id).sort()).toEqual(['card_discard_1', 'card_discard_2', 'card_discard_3']);
    expect(allCards.some((c) => c.color === 'locomotive')).toBe(true);
  });

  it('handles empty deck and empty discard pile gracefully without errors or invalid draws', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });

    // Empty deck, discard pile, and face-up cards
    game = {
      ...game,
      phase: 'playing',
      status: 'active',
      currentPlayerId: 'p1',
      trainCardDeck: [],
      trainCardDiscardPile: [],
      faceUpTrainCards: [],
    };

    expect(() => {
      game = drawTrainCards(game, 'p1', 2);
    }).not.toThrow();

    // No invalid cards added to hand
    expect(game.players.p1.trainCards).toHaveLength(0);
    expect(game.players.p1.trainCards.every((c) => Boolean(c && c.id))).toBe(true);
  });

  it('prevents duplicate card draws during concurrent multiplayer actions', async () => {
    const { createGameInFirestore, executeTurnActionInFirestore, joinGameInFirestore, startGameInFirestore } = await import('../services/firebase');
    const gameId = `test_concurrent_${Date.now()}`;

    await createGameInFirestore(gameId, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    await joinGameInFirestore(gameId, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    let game = await startGameInFirestore(gameId);

    // Confirm tickets
    const p1Tickets = game.players.p1.pendingDestinationTickets!.map((t) => t.id);
    const p2Tickets = game.players.p2.pendingDestinationTickets!.map((t) => t.id);
    const { selectDestinationTicketsInFirestore } = await import('../services/firebase');
    await selectDestinationTicketsInFirestore(gameId, 'p1', p1Tickets);
    game = await selectDestinationTicketsInFirestore(gameId, 'p2', p2Tickets);

    // p1 attempts two concurrent turn actions at the same time
    const [res1, res2] = await Promise.allSettled([
      executeTurnActionInFirestore(gameId, 'p1', { type: 'DRAW_TRAIN_CARDS' }),
      executeTurnActionInFirestore(gameId, 'p1', { type: 'DRAW_TRAIN_CARDS' }),
    ]);

    // Exactly one action succeeds for p1's turn, the concurrent second action is rejected
    const succeeded = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Verify all cards drawn across both players remain unique with no duplicate IDs
    const finalGame = (succeeded[0] as PromiseFulfilledResult<Game>).value;
    const p1Cards = finalGame.players.p1.trainCards.map((c) => c.id);
    const p2Cards = finalGame.players.p2.trainCards.map((c) => c.id);
    const allDrawnCardIds = [...p1Cards, ...p2Cards];
    const uniqueDrawnCardIds = new Set(allDrawnCardIds);

    expect(uniqueDrawnCardIds.size).toBe(allDrawnCardIds.length);
  });

  it('allows players to discard cards from hand into discard pile', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    const card1: TrainCard = { id: 'c1', color: 'green' };
    const card2: TrainCard = { id: 'c2', color: 'yellow' };
    const card3: TrainCard = { id: 'c3', color: 'locomotive' };

    game.players.p1.trainCards = [card1, card2, card3];

    // Discard card1 and card3
    game = discardTrainCards(game, 'p1', [card1, card3]);

    expect(game.players.p1.trainCards).toEqual([card2]);
    expect(game.trainCardDiscardPile).toEqual([card1, card3]);
  });

  it('throws an error when discarding cards that player does not hold', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    game.players.p1.trainCards = [{ id: 'c1', color: 'green' }];

    expect(() => {
      discardTrainCards(game, 'p1', [{ id: 'c2', color: 'yellow' }]);
    }).toThrow(/not found in player hand/);
  });
});
