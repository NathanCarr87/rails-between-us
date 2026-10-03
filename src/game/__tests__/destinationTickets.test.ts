import { describe, expect, it } from 'vitest';
import {
  createStandardDestinationDeck,
  DEFAULT_CITIES,
} from '../rules/defaults';
import {
  addPlayer,
  createGame,
  drawDestinationTickets,
  selectDestinationTickets,
} from '../state/gameEngine';
import type { DestinationTicket } from '../model/types';

describe('Destination Tickets', () => {
  it('creates a standard destination deck with valid USA board cities and points', () => {
    const deck = createStandardDestinationDeck(false);
    expect(deck.length).toBeGreaterThanOrEqual(30);

    for (const ticket of deck) {
      expect(ticket.id).toBeDefined();
      expect(ticket.cityA).toBeDefined();
      expect(ticket.cityB).toBeDefined();
      expect(ticket.points).toBeGreaterThan(0);

      // Verify cities exist in DEFAULT_CITIES
      expect(DEFAULT_CITIES[ticket.cityA]).toBeDefined();
      expect(DEFAULT_CITIES[ticket.cityB]).toBeDefined();
    }
  });

  it('allows players to draw destination tickets from the deck', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    const initialDeckLength = game.destinationTicketDeck.length;
    const drawResult = drawDestinationTickets(game, 'p1', 3);

    expect(drawResult.drawnTickets).toHaveLength(3);
    expect(drawResult.game.destinationTicketDeck).toHaveLength(initialDeckLength - 3);
  });

  it('allows keeping selected tickets and returning unselected tickets to deck', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    const drawResult = drawDestinationTickets(game, 'p1', 3);
    const [kept1, kept2, returned1] = drawResult.drawnTickets;

    const deckSizeAfterDraw = drawResult.game.destinationTicketDeck.length;

    const gameAfterSelection = selectDestinationTickets(
      drawResult.game,
      'p1',
      [kept1, kept2],
      [returned1]
    );

    // Kept tickets should be in player's destinationTickets
    expect(gameAfterSelection.players.p1.destinationTickets).toEqual([kept1, kept2]);

    // Unselected ticket returned to deck
    expect(gameAfterSelection.destinationTicketDeck).toHaveLength(deckSizeAfterDraw + 1);
    expect(gameAfterSelection.destinationTicketDeck[0]).toEqual(returned1);
  });

  it('handles empty destination deck when drawing', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    // Empty deck
    game = {
      ...game,
      destinationTicketDeck: [],
    };

    const drawResult = drawDestinationTickets(game, 'p1', 3);
    expect(drawResult.drawnTickets).toHaveLength(0);
    expect(drawResult.game.destinationTicketDeck).toHaveLength(0);
  });

  it('throws an error when non-existent player draws or selects tickets', () => {
    const game = createGame();

    expect(() => {
      drawDestinationTickets(game, 'non_existent_player', 3);
    }).toThrow(/does not exist/);

    const ticket: DestinationTicket = {
      id: 'test_ticket',
      cityA: 'boston',
      cityB: 'miami',
      points: 12,
    };

    expect(() => {
      selectDestinationTickets(game, 'non_existent_player', [ticket], []);
    }).toThrow(/does not exist/);
  });
});
