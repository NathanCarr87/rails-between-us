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
  confirmDestinationTicketSelection,
  createGame,
  executeTurnAction,
  isTicketCompleted,
  startGame,
} from '../state/gameEngine';
import type { DestinationTicket } from '../model/types';

describe('Destination Tickets Rules', () => {
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

  it('1. Each player receives 3 destination tickets at game start', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });

    const startedGame = startGame(game);

    expect(startedGame.players.p1.pendingDestinationTickets).toHaveLength(3);
    expect(startedGame.players.p2.pendingDestinationTickets).toHaveLength(3);
    expect(startedGame.players.p1.pendingTicketsMinKeep).toBe(2);
    expect(startedGame.players.p2.pendingTicketsMinKeep).toBe(2);
  });

  it('2. Initial setup requires keeping at least 2 tickets', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    const pending = game.players.p1.pendingDestinationTickets!;
    expect(pending).toHaveLength(3);

    // Keeping only 1 ticket during initial setup throws an error
    expect(() => {
      confirmDestinationTicketSelection(game, 'p1', [pending[0].id]);
    }).toThrow(/Must keep at least 2/);

    // Keeping 0 tickets throws an error
    expect(() => {
      confirmDestinationTicketSelection(game, 'p1', []);
    }).toThrow(/Must keep at least 2/);
  });

  it('3. Initial setup allows keeping all 3 tickets or keeping 2', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    const pending = game.players.p1.pendingDestinationTickets!;

    // Keeping 2 tickets succeeds
    const gameKeep2 = confirmDestinationTicketSelection(game, 'p1', [pending[0].id, pending[1].id]);
    expect(gameKeep2.players.p1.destinationTickets).toHaveLength(2);
    expect(gameKeep2.players.p1.pendingDestinationTickets).toHaveLength(0);

    // Keeping all 3 tickets succeeds
    const gameKeep3 = confirmDestinationTicketSelection(game, 'p1', [pending[0].id, pending[1].id, pending[2].id]);
    expect(gameKeep3.players.p1.destinationTickets).toHaveLength(3);
    expect(gameKeep3.players.p1.pendingDestinationTickets).toHaveLength(0);
  });

  it('4. Drawing tickets during the game offers exactly 3 tickets', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    // Confirm initial tickets first
    game = confirmDestinationTicketSelection(game, 'p1', game.players.p1.pendingDestinationTickets!.map(t => t.id));
    game = confirmDestinationTicketSelection(game, 'p2', game.players.p2.pendingDestinationTickets!.map(t => t.id));

    // Player 1 draws destination tickets during gameplay
    const initialDeckLength = game.destinationTicketDeck.length;
    game = executeTurnAction(game, 'p1', { type: 'DRAW_DESTINATION_TICKETS' });

    expect(game.players.p1.pendingDestinationTickets).toHaveLength(3);
    expect(game.players.p1.pendingTicketsMinKeep).toBe(1);
    expect(game.destinationTicketDeck).toHaveLength(initialDeckLength - 3);
  });

  it('5. During gameplay, at least 1 newly drawn ticket must be kept', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    // Confirm initial tickets
    game = confirmDestinationTicketSelection(game, 'p1', game.players.p1.pendingDestinationTickets!.map(t => t.id));
    game = confirmDestinationTicketSelection(game, 'p2', game.players.p2.pendingDestinationTickets!.map(t => t.id));

    // Player 1 draws destination tickets on their turn
    game = executeTurnAction(game, 'p1', { type: 'DRAW_DESTINATION_TICKETS' });

    const pending = game.players.p1.pendingDestinationTickets!;

    // Attempting to keep 0 tickets during gameplay throws an error
    expect(() => {
      confirmDestinationTicketSelection(game, 'p1', []);
    }).toThrow(/Must keep at least 1/);

    // Keeping 1 ticket succeeds
    const gameAfterKeep1 = confirmDestinationTicketSelection(game, 'p1', [pending[0].id]);
    expect(gameAfterKeep1.players.p1.destinationTickets).toHaveLength(4); // 3 initial + 1 newly kept
  });

  it('6. Unwanted tickets return to the bottom of the destination-ticket deck', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    // Confirm initial tickets
    game = confirmDestinationTicketSelection(game, 'p1', game.players.p1.pendingDestinationTickets!.map(t => t.id));
    game = confirmDestinationTicketSelection(game, 'p2', game.players.p2.pendingDestinationTickets!.map(t => t.id));

    game = executeTurnAction(game, 'p1', { type: 'DRAW_DESTINATION_TICKETS' });

    const pending = game.players.p1.pendingDestinationTickets!;
    const kept = [pending[0]];
    const unwanted = [pending[1], pending[2]];

    game = confirmDestinationTicketSelection(game, 'p1', [kept[0].id]);

    // Check deck: unwanted tickets should be at index 0 and 1 (bottom of deck array)
    expect(game.destinationTicketDeck.slice(0, 2)).toEqual(unwanted);
  });

  it('7. Kept tickets persist for the player', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    const pendingP1 = game.players.p1.pendingDestinationTickets!;
    game = confirmDestinationTicketSelection(game, 'p1', [pendingP1[0].id, pendingP1[1].id]);

    expect(game.players.p1.destinationTickets).toEqual([pendingP1[0], pendingP1[1]]);

    // Draw more tickets on turn
    game = executeTurnAction(game, 'p1', { type: 'DRAW_DESTINATION_TICKETS' });
    const newlyDrawn = game.players.p1.pendingDestinationTickets!;
    game = confirmDestinationTicketSelection(game, 'p1', [newlyDrawn[0].id]);

    // All kept tickets persist in player hand
    expect(game.players.p1.destinationTickets).toHaveLength(3);
    expect(game.players.p1.destinationTickets).toEqual([pendingP1[0], pendingP1[1], newlyDrawn[0]]);
  });

  it('8. Destination tickets remain private to each player', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    const p1Pending = game.players.p1.pendingDestinationTickets!;
    const p2Pending = game.players.p2.pendingDestinationTickets!;

    game = confirmDestinationTicketSelection(game, 'p1', [p1Pending[0].id, p1Pending[1].id]);
    game = confirmDestinationTicketSelection(game, 'p2', [p2Pending[0].id, p2Pending[1].id]);

    // p1 hand does not contain p2 tickets and vice versa
    expect(game.players.p1.destinationTickets).not.toEqual(game.players.p2.destinationTickets);
    expect(game.players.p1.destinationTickets).toHaveLength(2);
    expect(game.players.p2.destinationTickets).toHaveLength(2);
  });

  it('9. Drawing destination tickets consumes the player’s turn', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = startGame(game);

    // Confirm initial setup tickets
    game = confirmDestinationTicketSelection(game, 'p1', game.players.p1.pendingDestinationTickets!.map(t => t.id));
    game = confirmDestinationTicketSelection(game, 'p2', game.players.p2.pendingDestinationTickets!.map(t => t.id));

    expect(game.currentPlayerId).toBe('p1');
    expect(game.turnNumber).toBe(1);

    // p1 draws destination tickets during turn
    game = executeTurnAction(game, 'p1', { type: 'DRAW_DESTINATION_TICKETS' });

    // Confirming ticket selection finishes the turn and advances turn to p2
    const pendingP1 = game.players.p1.pendingDestinationTickets!;
    game = confirmDestinationTicketSelection(game, 'p1', [pendingP1[0].id]);

    expect(game.currentPlayerId).toBe('p2');
    expect(game.turnNumber).toBe(2);
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
