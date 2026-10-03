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
import type { TrainCard } from '../model/types';

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

  it('reshuffles discard pile into deck when deck is empty', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    // Empty the deck and put some cards in the discard pile
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

    expect(game.players.p1.trainCards).toHaveLength(2);
    // 3 discarded cards - 2 drawn = 1 remaining in deck
    expect(game.trainCardDeck).toHaveLength(1);
    expect(game.trainCardDiscardPile).toHaveLength(0);
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
