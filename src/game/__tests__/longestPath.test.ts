import { describe, expect, it } from 'vitest';
import type { Player, Route } from '../model/types';
import { calculateLongestContinuousPath, calculateLongestPathBonuses } from '../state/gameEngine';

describe('Longest Continuous Path Audit & Tests', () => {
  const dummyRoute = (id: string, cityA: string, cityB: string, length: number): Route => ({
    routeId: id,
    cityA,
    cityB,
    length,
    colorRequirement: 'any',
    ownerPlayerId: null,
  });

  it('1. Simple linear path: sums connected route lengths correctly', () => {
    // A - B (3) - C (4) - D (2)
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'A', 'B', 3),
      r2: dummyRoute('r2', 'B', 'C', 4),
      r3: dummyRoute('r3', 'C', 'D', 2),
    };
    const claimedRouteIds = ['r1', 'r2', 'r3'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(9);
  });

  it('2. Branching network: selects the single longest continuous path instead of total length', () => {
    // Hub B connected to A (4), C (3), D (5)
    // Possible paths: A-B-C (7), A-B-D (9), C-B-D (8)
    // Total network length = 12, but longest path = 9
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'A', 'B', 4),
      r2: dummyRoute('r2', 'B', 'C', 3),
      r3: dummyRoute('r3', 'B', 'D', 5),
    };
    const claimedRouteIds = ['r1', 'r2', 'r3'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(9);
  });

  it('3. Loops/cycles: correctly traverses a closed loop without infinite recursion or duplicating routes', () => {
    // Triangle: A - B (2), B - C (3), C - A (4)
    // Loop path: A -> B -> C -> A (or any city start/end) = 2 + 3 + 4 = 9
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'A', 'B', 2),
      r2: dummyRoute('r2', 'B', 'C', 3),
      r3: dummyRoute('r3', 'C', 'A', 4),
    };
    const claimedRouteIds = ['r1', 'r2', 'r3'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(9);
  });

  it('4. Multiple disconnected networks: finds longest path across separate networks', () => {
    // Network 1: X - Y (5)
    // Network 2: A - B (3) - C (5) -> Length 8
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'X', 'Y', 5),
      r2: dummyRoute('r2', 'A', 'B', 3),
      r3: dummyRoute('r3', 'B', 'C', 5),
    };
    const claimedRouteIds = ['r1', 'r2', 'r3'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(8);
  });

  it('5. Total connected route length is greater than actual longest continuous path', () => {
    // Star topology: Central Hub H connected to 4 spokes: S1 (3), S2 (3), S3 (3), S4 (3)
    // Total connected length = 12
    // Longest continuous path uses at most 2 spokes through H = 3 + 3 = 6
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'H', 'S1', 3),
      r2: dummyRoute('r2', 'H', 'S2', 3),
      r3: dummyRoute('r3', 'H', 'S3', 3),
      r4: dummyRoute('r4', 'H', 'S4', 3),
    };
    const claimedRouteIds = ['r1', 'r2', 'r3', 'r4'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(6);
  });

  it('6. Tied longest paths: awards 10-point bonus to all tied players', () => {
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'A', 'B', 6),
      r2: dummyRoute('r2', 'C', 'D', 6),
      r3: dummyRoute('r3', 'E', 'F', 4),
    };

    const players: Record<string, Player> = {
      p1: {
        playerId: 'p1',
        displayName: 'Alice',
        color: '#red',
        ready: true,
        trainCards: [],
        destinationTickets: [],
        claimedRoutes: ['r1'],
        trainsRemaining: 39,
        score: 15,
      },
      p2: {
        playerId: 'p2',
        displayName: 'Bob',
        color: '#blue',
        ready: true,
        trainCards: [],
        destinationTickets: [],
        claimedRoutes: ['r2'],
        trainsRemaining: 39,
        score: 15,
      },
      p3: {
        playerId: 'p3',
        displayName: 'Charlie',
        color: '#green',
        ready: true,
        trainCards: [],
        destinationTickets: [],
        claimedRoutes: ['r3'],
        trainsRemaining: 41,
        score: 7,
      },
    };

    const bonuses = calculateLongestPathBonuses(players, routes);

    expect(bonuses['p1']).toEqual({ length: 6, bonus: 10 });
    expect(bonuses['p2']).toEqual({ length: 6, bonus: 10 });
    expect(bonuses['p3']).toEqual({ length: 4, bonus: 0 });
  });

  it('7. Ensures a route segment cannot be counted twice in a single continuous path', () => {
    // Dead-end route: A - B (5)
    // If route r1 is used to go A -> B, DFS cannot backtrack along r1 to go B -> A again
    const routes: Record<string, Route> = {
      r1: dummyRoute('r1', 'A', 'B', 5),
    };
    const claimedRouteIds = ['r1'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(5); // Not 10
  });

  it('8. Loop with a tail (P-shape graph): city is revisited but edges are not duplicated', () => {
    // Tail: T - A (3)
    // Loop: A - B (2) - C (4) - A (5)
    // Total graph has 4 edges: T-A(3), A-B(2), B-C(4), C-A(5)
    // Path starting at T: T -> A -> B -> C -> A = 3 + 2 + 4 + 5 = 14
    // At city A (revisited), no more unused edges remain, so DFS terminates.
    const routes: Record<string, Route> = {
      rTail: dummyRoute('rTail', 'T', 'A', 3),
      r1: dummyRoute('r1', 'A', 'B', 2),
      r2: dummyRoute('r2', 'B', 'C', 4),
      r3: dummyRoute('r3', 'C', 'A', 5),
    };
    const claimedRouteIds = ['rTail', 'r1', 'r2', 'r3'];

    const longest = calculateLongestContinuousPath(claimedRouteIds, routes);
    expect(longest).toBe(14);
  });
});
