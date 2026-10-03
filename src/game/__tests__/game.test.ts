import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  advanceTurn,
  calculatePlayerScore,
  calculateRouteCost,
  canClaimRoute,
  claimRoute,
  createGame,
  drawTrainCards,
  MAX_PLAYERS,
} from '../state/gameEngine';
import type { TrainCard } from '../model/types';

describe('Game Domain Model & Rules', () => {
  it('creates a new game with default state', () => {
    const game = createGame('test_game_1');

    expect(game.gameId).toBe('test_game_1');
    expect(game.status).toBe('waiting');
    expect(game.players).toEqual({});
    expect(game.playerOrder).toEqual([]);
    expect(game.currentPlayerId).toBeNull();
    expect(game.turnNumber).toBe(0);
    expect(Object.keys(game.boardState.cities).length).toBeGreaterThan(0);
    expect(Object.keys(game.boardState.routes).length).toBeGreaterThan(0);
    expect(game.trainCardDeck.length).toBeGreaterThan(0);
    expect(game.destinationTicketDeck.length).toBeGreaterThan(0);
  });

  it('allows adding 2 to 6 players and transition status to active', () => {
    let game = createGame();

    // Player 1
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    expect(game.status).toBe('waiting');
    expect(game.playerOrder.length).toBe(1);

    // Player 2 -> status becomes active
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    expect(game.status).toBe('active');
    expect(game.playerOrder.length).toBe(2);
    expect(game.currentPlayerId).toBe('p1');
    expect(game.turnNumber).toBe(1);

    // Add up to 6 players
    for (let i = 3; i <= MAX_PLAYERS; i++) {
      game = addPlayer(game, {
        playerId: `p${i}`,
        displayName: `Player ${i}`,
        color: 'green',
      });
    }
    expect(game.playerOrder.length).toBe(6);

    // Adding 7th player throws error
    expect(() => {
      addPlayer(game, { playerId: 'p7', displayName: 'Extra', color: 'yellow' });
    }).toThrow(/Maximum limit/);
  });

  it('advances turns correctly', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });
    game = addPlayer(game, { playerId: 'p3', displayName: 'Charlie', color: 'green' });

    expect(game.currentPlayerId).toBe('p1');
    expect(game.turnNumber).toBe(1);

    game = advanceTurn(game);
    expect(game.currentPlayerId).toBe('p2');
    expect(game.turnNumber).toBe(2);

    game = advanceTurn(game);
    expect(game.currentPlayerId).toBe('p3');

    game = advanceTurn(game);
    expect(game.currentPlayerId).toBe('p1'); // Wraps around
  });

  it('validates and claims routes cleanly', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });

    // Give p1 2 red cards
    const redCards: TrainCard[] = [
      { id: 'c1', color: 'red' },
      { id: 'c2', color: 'red' },
    ];
    game.players.p1.trainCards = [...redCards];

    const routeId = 'route_ab_red'; // requires 2 red cards
    const route = game.boardState.routes[routeId];
    expect(route).toBeDefined();

    // Check validity
    const validation = canClaimRoute(game, 'p1', routeId, redCards);
    expect(validation.allowed).toBe(true);

    // Claim route
    game = claimRoute(game, 'p1', routeId, redCards);

    expect(game.boardState.routes[routeId].ownerPlayerId).toBe('p1');
    expect(game.players.p1.claimedRoutes).toContain(routeId);
    expect(game.players.p1.score).toBe(2); // length 2 gives 2 points
    expect(game.players.p1.trainsRemaining).toBe(45 - 2);
    expect(game.players.p1.trainCards).toHaveLength(0);
    expect(game.currentPlayerId).toBe('p2'); // Turn advanced after claiming
  });

  it('rejects route claim when cards or player turn is invalid', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: 'blue' });

    const routeId = 'route_ab_red'; // length 2, color red

    // Wrong player turn
    const resWrongTurn = canClaimRoute(game, 'p2', routeId, [{ id: 'c1', color: 'red' }, { id: 'c2', color: 'red' }]);
    expect(resWrongTurn.allowed).toBe(false);
    expect(resWrongTurn.reason).toMatch(/Not this player turn/);

    // Wrong card colors
    const wrongColorCards: TrainCard[] = [
      { id: 'c1', color: 'blue' },
      { id: 'c2', color: 'blue' },
    ];
    const resWrongColor = canClaimRoute(game, 'p1', routeId, wrongColorCards);
    expect(resWrongColor.allowed).toBe(false);
    expect(resWrongColor.reason).toMatch(/requires red cards/);
  });

  it('draws train cards from deck', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: 'red' });

    const initialDeckSize = game.trainCardDeck.length;
    game = drawTrainCards(game, 'p1', 2);

    expect(game.players.p1.trainCards.length).toBe(2);
    expect(game.trainCardDeck.length).toBe(initialDeckSize - 2);
  });

  it('calculates player score', () => {
    const player = {
      playerId: 'p1',
      displayName: 'Alice',
      color: 'red',
      trainCards: [],
      destinationTickets: [],
      claimedRoutes: ['route_ab_red', 'route_cd_green'], // length 2 and length 4
      trainsRemaining: 39,
      score: 9,
    };

    const routes = {
      route_ab_red: { routeId: 'route_ab_red', cityA: 'a', cityB: 'b', length: 2, colorRequirement: 'red' as const, ownerPlayerId: 'p1' },
      route_cd_green: { routeId: 'route_cd_green', cityA: 'c', cityB: 'd', length: 4, colorRequirement: 'green' as const, ownerPlayerId: 'p1' },
    };

    const score = calculatePlayerScore(player, routes);
    expect(score).toBe(9); // 2 pts for length 2 + 7 pts for length 4
  });

  it('calculates route cost correctly', () => {
    const route = {
      routeId: 'route_cd_green',
      cityA: 'city_c',
      cityB: 'city_d',
      length: 4,
      colorRequirement: 'green' as const,
      ownerPlayerId: null,
    };

    const cost = calculateRouteCost(route);
    expect(cost).toEqual({
      length: 4,
      colorRequirement: 'green',
    });
  });
});
