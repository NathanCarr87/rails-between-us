import { describe, expect, it } from 'vitest';
import {
  createStandardDestinationDeck,
  DEFAULT_CITIES,
} from '../rules/defaults';
import {
  addPlayer,
  areCitiesConnected,
  calculateDestinationTicketScore,
  calculateFinalPlayerScore,
  calculatePlayerScore,
  createGame,
  drawDestinationTickets,
  isTicketCompleted,
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

  describe('Destination Ticket Connectivity & Scoring', () => {
    const mockRoutes = {
      route_boston_new_york: {
        routeId: 'route_boston_new_york',
        cityA: 'boston',
        cityB: 'new_york',
        length: 2,
        colorRequirement: 'red' as const,
        ownerPlayerId: 'p1',
      },
      route_new_york_washington: {
        routeId: 'route_new_york_washington',
        cityA: 'new_york',
        cityB: 'washington',
        length: 2,
        colorRequirement: 'orange' as const,
        ownerPlayerId: 'p1',
      },
      route_washington_raleigh: {
        routeId: 'route_washington_raleigh',
        cityA: 'washington',
        cityB: 'raleigh',
        length: 2,
        colorRequirement: 'any' as const,
        ownerPlayerId: 'p1',
      },
      route_chicago_omaha: {
        routeId: 'route_chicago_omaha',
        cityA: 'chicago',
        cityB: 'omaha',
        length: 4,
        colorRequirement: 'blue' as const,
        ownerPlayerId: 'p2',
      },
    };

    it('correctly determines if cities are connected by claimed routes', () => {
      // Directly connected
      expect(
        areCitiesConnected('boston', 'new_york', ['route_boston_new_york'], mockRoutes)
      ).toBe(true);

      // Connected via path of multiple claimed routes
      expect(
        areCitiesConnected(
          'boston',
          'raleigh',
          ['route_boston_new_york', 'route_new_york_washington', 'route_washington_raleigh'],
          mockRoutes
        )
      ).toBe(true);

      // Unconnected cities
      expect(
        areCitiesConnected(
          'boston',
          'chicago',
          ['route_boston_new_york', 'route_new_york_washington'],
          mockRoutes
        )
      ).toBe(false);

      // Same city always connected
      expect(
        areCitiesConnected('boston', 'boston', [], mockRoutes)
      ).toBe(true);
    });

    it('identifies completed and incomplete destination tickets', () => {
      const ticketCompleted: DestinationTicket = {
        id: 't1',
        cityA: 'boston',
        cityB: 'washington',
        points: 8,
      };

      const ticketIncomplete: DestinationTicket = {
        id: 't2',
        cityA: 'boston',
        cityB: 'miami',
        points: 12,
      };

      const p1Claimed = ['route_boston_new_york', 'route_new_york_washington'];

      expect(isTicketCompleted(ticketCompleted, p1Claimed, mockRoutes)).toBe(true);
      expect(isTicketCompleted(ticketIncomplete, p1Claimed, mockRoutes)).toBe(false);
    });

    it('adds points for completed tickets and subtracts points for incomplete tickets', () => {
      const tickets: DestinationTicket[] = [
        { id: 't1', cityA: 'boston', cityB: 'washington', points: 8 }, // completed (+8)
        { id: 't2', cityA: 'boston', cityB: 'miami', points: 12 },     // incomplete (-12)
        { id: 't3', cityA: 'new_york', cityB: 'raleigh', points: 6 },  // completed (+6)
      ];

      const p1Claimed = [
        'route_boston_new_york',
        'route_new_york_washington',
        'route_washington_raleigh',
      ];

      const ticketScore = calculateDestinationTicketScore(tickets, p1Claimed, mockRoutes);
      // +8 - 12 + 6 = +2
      expect(ticketScore).toBe(2);
    });

    it('calculates final player score combining route points and ticket scoring when game ends', () => {
      const player = {
        playerId: 'p1',
        displayName: 'Alice',
        color: 'red',
        ready: true,
        trainCards: [],
        destinationTickets: [
          { id: 't1', cityA: 'boston', cityB: 'washington', points: 8 }, // completed (+8)
          { id: 't2', cityA: 'boston', cityB: 'miami', points: 12 },     // incomplete (-12)
        ],
        claimedRoutes: ['route_boston_new_york', 'route_new_york_washington'], // length 2 (2pts) + length 2 (2pts) = 4 pts
        trainsRemaining: 41,
        score: 4,
      };

      // Base route points = 4. Ticket score = 8 - 12 = -4. Total final score = 0.
      const finalScore = calculateFinalPlayerScore(player, mockRoutes);
      expect(finalScore).toBe(0);

      const scoreWithTickets = calculatePlayerScore(player, mockRoutes, true);
      expect(scoreWithTickets).toBe(0);

      const scoreWithoutTickets = calculatePlayerScore(player, mockRoutes, false);
      expect(scoreWithoutTickets).toBe(4);
    });
  });
});
