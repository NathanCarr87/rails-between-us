import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  advanceTurn,
  calculateLongestContinuousPath,
  calculateLongestPathBonuses,
  calculatePlayerScore,
  calculateRouteCost,
  canClaimRoute,
  claimRoute,
  confirmDestinationTicketSelection,
  createGame,
  drawTrainCards,
  executeTurnAction,
  isTicketCompleted,
  MAX_PLAYERS,
  startGame,
} from '../state/gameEngine';
import {
  createGameInFirestore,
  executeTurnActionInFirestore,
  joinGameInFirestore,
  selectDestinationTicketsInFirestore,
  startGameInFirestore,
} from '../services/firebase';
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

describe('Game Domain Model & Rules', () => {
  it('creates a new game with default state', () => {
    const game = createGame('test_game_1');

    expect(game.gameId).toBe('test_game_1');
    expect(game.status).toBe('waiting');
    expect(game.players).toEqual({});
    expect(game.playerOrder).toEqual([]);
    expect(game.currentPlayerId).toBeNull();
    expect(game.turnNumber).toBe(0);
    expect(Object.keys(game.boardState.cities).length).toBe(36);
    expect(Object.keys(game.boardState.routes).length).toBe(102);
    expect(game.trainCardDeck.length).toBeGreaterThan(0);
    expect(game.destinationTicketDeck.length).toBeGreaterThan(0);
  });

  it('allows adding 2 to 6 players with unique colors and starting the game', () => {
    let game = createGame();

    // Player 1
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    expect(game.status).toBe('waiting');
    expect(game.phase).toBe('lobby');
    expect(game.playerOrder.length).toBe(1);

    // Player 2
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    expect(game.playerOrder.length).toBe(2);

    // Colors must be unique
    expect(() => {
      addPlayer(game, { playerId: 'p3_dup', displayName: 'Dup', color: '#e53e3e' });
    }).toThrow(/already chosen/);

    const colors = ['#38a169', '#d69e2e', '#805ad5', '#dd6b20'];
    for (let i = 3; i <= MAX_PLAYERS; i++) {
      game = addPlayer(game, {
        playerId: `p${i}`,
        displayName: `Player ${i}`,
        color: colors[i - 3],
      });
    }
    expect(game.playerOrder.length).toBe(6);

    // Adding 7th player throws error
    expect(() => {
      addPlayer(game, { playerId: 'p7', displayName: 'Extra', color: '#2d3748' });
    }).toThrow(/Maximum limit/);
  });

  it('advances turns correctly when game is started', () => {
    let game = createGame();
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = addPlayer(game, { playerId: 'p3', displayName: 'Charlie', color: '#38a169' });
    game = startAndConfirmGame(game);

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
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    // Give p1 2 red cards
    const redCards: TrainCard[] = [
      { id: 'c1', color: 'red' },
      { id: 'c2', color: 'red' },
    ];
    game.players.p1.trainCards = [...redCards];

    const routeId = 'route_boston_new_york_red'; // requires 2 red cards
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
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
    game = startAndConfirmGame(game);

    const routeId = 'route_boston_new_york_red'; // length 2, color red

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
      ready: true,
      trainCards: [],
      destinationTickets: [],
      claimedRoutes: ['route_boston_new_york_red', 'route_denver_helena_green'], // length 2 and length 4
      trainsRemaining: 39,
      score: 9,
    };

    const routes = {
      route_boston_new_york_red: { routeId: 'route_boston_new_york_red', cityA: 'boston', cityB: 'new_york', length: 2, colorRequirement: 'red' as const, ownerPlayerId: 'p1' },
      route_denver_helena_green: { routeId: 'route_denver_helena_green', cityA: 'denver', cityB: 'helena', length: 4, colorRequirement: 'green' as const, ownerPlayerId: 'p1' },
    };

    const score = calculatePlayerScore(player, routes);
    expect(score).toBe(9); // 2 pts for length 2 + 7 pts for length 4
  });

  it('calculates route cost correctly', () => {
    const route = {
      routeId: 'route_denver_helena_green',
      cityA: 'denver',
      cityB: 'helena',
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

  describe('Player Turn Actions & Turn Advancement', () => {
    it('draws 2 train cards and advances turn', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = startAndConfirmGame(game);

      expect(game.currentPlayerId).toBe('p1');
      const p1InitialCardCount = game.players.p1.trainCards.length;
      const initialDeckCount = game.trainCardDeck.length;

      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' });

      expect(game.players.p1.trainCards.length).toBe(p1InitialCardCount + 2);
      expect(game.trainCardDeck.length).toBe(initialDeckCount - 2);
      expect(game.currentPlayerId).toBe('p2');
      expect(game.turnNumber).toBe(2);
    });

    it('claims a route and advances turn', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = startAndConfirmGame(game);

      const redCards: TrainCard[] = [
        { id: 'c1', color: 'red' },
        { id: 'c2', color: 'red' },
      ];
      game.players.p1.trainCards = [...redCards];
      const routeId = 'route_boston_new_york_red';

      game = executeTurnAction(game, 'p1', {
        type: 'CLAIM_ROUTE',
        routeId,
        cardsToUse: redCards,
      });

      expect(game.boardState.routes[routeId].ownerPlayerId).toBe('p1');
      expect(game.players.p1.claimedRoutes).toContain(routeId);
      expect(game.currentPlayerId).toBe('p2');
      expect(game.turnNumber).toBe(2);
    });

    it('draws destination tickets into pending and advances turn upon selection', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = startAndConfirmGame(game);

      expect(game.currentPlayerId).toBe('p1');
      const initialTicketDeckCount = game.destinationTicketDeck.length;

      // Draw destination tickets action puts drawn tickets into pending
      game = executeTurnAction(game, 'p1', { type: 'DRAW_DESTINATION_TICKETS' });

      expect(game.players.p1.pendingDestinationTickets?.length).toBeGreaterThan(0);
      expect(game.destinationTicketDeck.length).toBe(initialTicketDeckCount - 3);

      // Select destination tickets action keeps selected tickets and advances turn
      const pendingIds = (game.players.p1.pendingDestinationTickets || []).map((t) => t.id);
      game = executeTurnAction(game, 'p1', {
        type: 'SELECT_DESTINATION_TICKETS',
        keptTicketIds: pendingIds,
      });

      expect(game.players.p1.destinationTickets.length).toBeGreaterThanOrEqual(3);
      expect(game.players.p1.pendingDestinationTickets).toHaveLength(0);
      expect(game.currentPlayerId).toBe('p2');
      expect(game.turnNumber).toBe(2);
    });

    it('throws error when performing action out of turn', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = startAndConfirmGame(game);

      expect(game.currentPlayerId).toBe('p1');

      expect(() => {
        executeTurnAction(game, 'p2', { type: 'DRAW_TRAIN_CARDS' });
      }).toThrow(/Not player p2's turn/);

      expect(() => {
        executeTurnAction(game, 'p2', { type: 'DRAW_DESTINATION_TICKETS' });
      }).toThrow(/Not player p2's turn/);

      expect(() => {
        executeTurnAction(game, 'p2', {
          type: 'CLAIM_ROUTE',
          routeId: 'route_boston_new_york_red',
          cardsToUse: [{ id: 'c1', color: 'red' }, { id: 'c2', color: 'red' }],
        });
      }).toThrow(/Not this player turn/);
    });

    it('executes turn actions via executeTurnActionInFirestore service correctly', async () => {
      const gameId = 'test_fs_turn_1';
      await createGameInFirestore(gameId, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      await joinGameInFirestore(gameId, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      let game = await startGameInFirestore(gameId);

      // Confirm initial tickets
      game = await selectDestinationTicketsInFirestore(
        gameId,
        'p1',
        game.players.p1.pendingDestinationTickets!.map((t) => t.id)
      );
      game = await selectDestinationTicketsInFirestore(
        gameId,
        'p2',
        game.players.p2.pendingDestinationTickets!.map((t) => t.id)
      );

      expect(game.currentPlayerId).toBe('p1');
      // Game start deals 4 initial train cards
      expect(game.players.p1.trainCards.length).toBe(4);

      // p1 draws cards
      game = await executeTurnActionInFirestore(gameId, 'p1', { type: 'DRAW_TRAIN_CARDS' });

      expect(game.players.p1.trainCards.length).toBe(6);
      expect(game.currentPlayerId).toBe('p2');

      // Attempt by p1 out of turn fails
      await expect(
        executeTurnActionInFirestore(gameId, 'p1', { type: 'DRAW_TRAIN_CARDS' })
      ).rejects.toThrow(/not player p1's turn/i);

      // p2 draws cards (p2 started with 4 cards, draws 2 -> 6)
      game = await executeTurnActionInFirestore(gameId, 'p2', { type: 'DRAW_TRAIN_CARDS' });
      expect(game.players.p2.trainCards.length).toBe(6);
      expect(game.currentPlayerId).toBe('p1');
    });
  });

  describe('End-Game Trigger & Completion Logic', () => {
    it('triggers final round when a player has 2 or fewer trains remaining', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = addPlayer(game, { playerId: 'p3', displayName: 'Charlie', color: '#38a169' });
      game = startAndConfirmGame(game);

      // Simulate p1 having 2 trains remaining
      game.players.p1.trainsRemaining = 2;

      expect(game.isFinalRound).toBe(false);

      // p1 completes an action (draws train cards)
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' });

      // Final round should now be triggered
      expect(game.isFinalRound).toBe(true);
      expect(game.finalRoundTriggeredBy).toBe('p1');
      expect(game.status).toBe('active');
      expect(game.currentPlayerId).toBe('p2'); // Turn moves to p2
    });

    it('allows every player including triggerer exactly one final turn before marking game completed', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = addPlayer(game, { playerId: 'p3', displayName: 'Charlie', color: '#38a169' });
      game = startAndConfirmGame(game);

      // p1 triggers final round at end of turn
      game.players.p1.trainsRemaining = 1;
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' });

      expect(game.isFinalRound).toBe(true);
      expect(game.finalRoundTriggeredBy).toBe('p1');
      expect(game.currentPlayerId).toBe('p2');

      // p2 takes final turn
      game = executeTurnAction(game, 'p2', { type: 'DRAW_TRAIN_CARDS' });
      expect(game.status).toBe('active');
      expect(game.currentPlayerId).toBe('p3');

      // p3 takes final turn
      game = executeTurnAction(game, 'p3', { type: 'DRAW_TRAIN_CARDS' });
      expect(game.status).toBe('active');
      expect(game.currentPlayerId).toBe('p1');

      // p1 takes their final turn
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' });

      // All players (p2, p3, p1) have completed 1 turn in final round
      expect(game.status).toBe('completed');
      expect(game.phase).toBe('finished');
      expect(game.currentPlayerId).toBeNull();
    });

    it('rejects gameplay actions after game ends', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = startAndConfirmGame(game);

      // p1 triggers final round
      game.players.p1.trainsRemaining = 0;
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' }); // p2's turn
      game = executeTurnAction(game, 'p2', { type: 'DRAW_TRAIN_CARDS' }); // p1's final turn
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' }); // game finishes

      expect(game.phase).toBe('finished');
      expect(game.status).toBe('completed');

      // Any further turn action should throw error
      expect(() => {
        executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' });
      }).toThrow(/Game is finished/);

      expect(() => {
        executeTurnAction(game, 'p2', { type: 'DRAW_TRAIN_CARDS' });
      }).toThrow(/Game is finished/);
    });

    it('calculates final scores including destination tickets, connected paths, and longest path bonus', () => {
      let game = createGame();
      game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e' });
      game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce' });
      game = startAndConfirmGame(game);

      // Setup p1 destination tickets and claimed routes:
      // Ticket 1: Boston -> Washington (8 pts) - COMPLETED via Boston -> New York -> Washington
      // Ticket 2: Boston -> Miami (12 pts) - INCOMPLETE (-12 pts)
      game.players.p1.destinationTickets = [
        { id: 't1', cityA: 'boston', cityB: 'washington', points: 8 },
        { id: 't2', cityA: 'boston', cityB: 'miami', points: 12 },
      ];

      // Route 1: Boston -> New York (length 2, 2 pts)
      // Route 2: New York -> Washington (length 2, 2 pts)
      game.players.p1.claimedRoutes = ['route_boston_new_york_red', 'route_new_york_washington_orange'];
      game.boardState.routes['route_boston_new_york_red'].ownerPlayerId = 'p1';
      game.boardState.routes['route_new_york_washington_orange'].ownerPlayerId = 'p1';

      // Verify connected path ticket completion
      expect(
        isTicketCompleted(
          game.players.p1.destinationTickets[0],
          game.players.p1.claimedRoutes,
          game.boardState.routes
        )
      ).toBe(true);

      // Setup p2 destination tickets & routes:
      // Ticket 3: Atlanta -> Charleston (2 pts) - COMPLETED
      game.players.p2.destinationTickets = [
        { id: 't3', cityA: 'atlanta', cityB: 'charleston', points: 2 },
      ];
      // p2 claims Atlanta -> Charleston (length 2) & Charleston -> Miami (length 4) -> Total path length = 6
      game.players.p2.claimedRoutes = ['route_atlanta_charleston_any', 'route_charleston_miami_purple'];
      game.boardState.routes['route_atlanta_charleston_any'].ownerPlayerId = 'p2';
      game.boardState.routes['route_charleston_miami_purple'].ownerPlayerId = 'p2';

      // p1 triggers final round
      game.players.p1.trainsRemaining = 0;
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' }); // moves to p2
      game = executeTurnAction(game, 'p2', { type: 'DRAW_TRAIN_CARDS' }); // moves to p1
      game = executeTurnAction(game, 'p1', { type: 'DRAW_TRAIN_CARDS' }); // finishes game

      expect(game.status).toBe('completed');
      expect(game.phase).toBe('finished');

      // Check p1 breakdown & final score:
      // Route points: 2 + 2 = 4
      // Ticket points: +8 - 12 = -4
      // Longest path length: 4 (Boston -> New York -> Washington). p2 has 6, so p1 gets 0 bonus.
      // Final total = 4 - 4 + 0 = 0
      expect(game.players.p1.scoreBreakdown?.routePoints).toBe(4);
      expect(game.players.p1.scoreBreakdown?.destinationTicketPoints).toBe(-4);
      expect(game.players.p1.scoreBreakdown?.longestPathLength).toBe(4);
      expect(game.players.p1.scoreBreakdown?.longestPathBonus).toBe(0);
      expect(game.players.p1.score).toBe(0);

      // Check p2 breakdown & final score:
      // Route points: 2 (len 2) + 7 (len 4) = 9
      // Ticket points: +2
      // Longest path length: 6 (Atlanta -> Charleston -> Miami). Max path! Awarded 10 bonus.
      // Final total = 9 + 2 + 10 = 21
      expect(game.players.p2.scoreBreakdown?.routePoints).toBe(9);
      expect(game.players.p2.scoreBreakdown?.destinationTicketPoints).toBe(2);
      expect(game.players.p2.scoreBreakdown?.longestPathLength).toBe(6);
      expect(game.players.p2.scoreBreakdown?.longestPathBonus).toBe(10);
      expect(game.players.p2.score).toBe(21);
    });

    it('calculates longest continuous path with branching correctly', () => {
      // Create mock routes forming a T-junction branch:
      // Route 1: A -> B (len 3)
      // Route 2: B -> C (len 4)
      // Route 3: B -> D (len 2)
      const mockRoutes = {
        r1: { routeId: 'r1', cityA: 'A', cityB: 'B', length: 3, colorRequirement: 'any' as const, ownerPlayerId: 'p1' },
        r2: { routeId: 'r2', cityA: 'B', cityB: 'C', length: 4, colorRequirement: 'any' as const, ownerPlayerId: 'p1' },
        r3: { routeId: 'r3', cityA: 'B', cityB: 'D', length: 2, colorRequirement: 'any' as const, ownerPlayerId: 'p1' },
      };

      const claimedIds = ['r1', 'r2', 'r3'];

      // Continuous path cannot use both B->C and B->D after A->B
      // Longest continuous path is A -> B -> C (len 3 + 4 = 7)
      const longest = calculateLongestContinuousPath(claimedIds, mockRoutes);
      expect(longest).toBe(7);
    });

    it('awards 10-point bonus to all tied players when multiple players tie for longest path', () => {
      const mockRoutes = {
        r1: { routeId: 'r1', cityA: 'A', cityB: 'B', length: 5, colorRequirement: 'any' as const, ownerPlayerId: null },
        r2: { routeId: 'r2', cityA: 'C', cityB: 'D', length: 5, colorRequirement: 'any' as const, ownerPlayerId: null },
      };

      const players = {
        p1: {
          playerId: 'p1',
          displayName: 'Alice',
          color: 'red',
          ready: true,
          trainCards: [],
          destinationTickets: [],
          claimedRoutes: ['r1'],
          trainsRemaining: 40,
          score: 0,
        },
        p2: {
          playerId: 'p2',
          displayName: 'Bob',
          color: 'blue',
          ready: true,
          trainCards: [],
          destinationTickets: [],
          claimedRoutes: ['r2'],
          trainsRemaining: 40,
          score: 0,
        },
      };

      const bonuses = calculateLongestPathBonuses(players, mockRoutes);

      expect(bonuses.p1).toEqual({ length: 5, bonus: 10 });
      expect(bonuses.p2).toEqual({ length: 5, bonus: 10 });
    });
  });
});
