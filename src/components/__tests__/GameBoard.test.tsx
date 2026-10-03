// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameBoard } from '../GameBoard';
import { DevGameView } from '../DevGameView';
import { CITY_COORDINATES } from '../cityCoordinates';
import { DEFAULT_CITIES, DEFAULT_ROUTES, getPointsForRouteLength } from '../../game/rules/defaults';
import { addPlayer, claimRoute, createGame } from '../../game/state/gameEngine';

afterEach(() => {
  cleanup();
});

describe('GameBoard visual coordinates', () => {
  it('has coordinates mapped for all default cities in the USA board', () => {
    const cityKeys = Object.keys(DEFAULT_CITIES);
    expect(cityKeys.length).toBeGreaterThan(0);

    for (const cityId of cityKeys) {
      const coord = CITY_COORDINATES[cityId];
      expect(coord, `Missing coordinates for city: ${cityId}`).toBeDefined();
      expect(typeof coord.x).toBe('number');
      expect(typeof coord.y).toBe('number');
    }
  });

  it('connects valid cities for all default routes', () => {
    for (const route of Object.values(DEFAULT_ROUTES)) {
      expect(CITY_COORDINATES[route.cityA]).toBeDefined();
      expect(CITY_COORDINATES[route.cityB]).toBeDefined();
    }
  });
});

describe('GameBoard interactive route selection and claiming', () => {
  const sampleBoardState = {
    cities: DEFAULT_CITIES,
    routes: DEFAULT_ROUTES,
  };

  const samplePlayers = {
    player_1: {
      playerId: 'player_1',
      displayName: 'Alice',
      color: '#e53e3e',
      trainCards: [],
      destinationTickets: [],
      claimedRoutes: [],
      trainsRemaining: 45,
      score: 0,
    },
  };

  it('calls onSelectRoute when a route element is clicked on the board', () => {
    const handleSelectRoute = vi.fn();
    render(
      <GameBoard
        boardState={sampleBoardState}
        players={samplePlayers}
        onSelectRoute={handleSelectRoute}
      />
    );

    const testRouteId = 'route_atlanta_charleston_any';
    const routeGroup = screen.getByTestId(`route-group-${testRouteId}`);
    expect(routeGroup).toBeDefined();

    fireEvent.click(routeGroup);
    expect(handleSelectRoute).toHaveBeenCalledWith(testRouteId);
  });

  it('displays selected route details (cities, length, color) and claim button when selectedRouteId is set', () => {
    const testRouteId = 'route_atlanta_miami_blue';
    const route = sampleBoardState.routes[testRouteId];

    render(
      <GameBoard
        boardState={sampleBoardState}
        players={samplePlayers}
        selectedRouteId={testRouteId}
        onSelectRoute={vi.fn()}
        onClaimRoute={vi.fn()}
      />
    );

    const panel = screen.getByTestId('selected-route-panel');
    expect(panel).toBeDefined();

    expect(screen.getByTestId('selected-route-length').textContent).toContain(`Length: ${route.length}`);
    expect(screen.getByTestId('selected-route-color').textContent).toContain(`Color: ${route.colorRequirement.toUpperCase()}`);

    const claimBtn = screen.getByTestId('board-claim-route-btn');
    expect(claimBtn).toBeDefined();
  });

  it('calls onClaimRoute when the Claim Route button is clicked', () => {
    const handleClaimRoute = vi.fn();
    const testRouteId = 'route_atlanta_charleston_any';

    render(
      <GameBoard
        boardState={sampleBoardState}
        players={samplePlayers}
        selectedRouteId={testRouteId}
        onClaimRoute={handleClaimRoute}
      />
    );

    const claimBtn = screen.getByTestId('board-claim-route-btn');
    fireEvent.click(claimBtn);

    expect(handleClaimRoute).toHaveBeenCalledWith(testRouteId);
  });

  it('updates board immediately to show route as owned and displays owner name', () => {
    const testRouteId = 'route_atlanta_charleston_any';
    const claimedRoutes = {
      ...sampleBoardState.routes,
      [testRouteId]: {
        ...sampleBoardState.routes[testRouteId],
        ownerPlayerId: 'player_1',
      },
    };

    render(
      <GameBoard
        boardState={{ ...sampleBoardState, routes: claimedRoutes }}
        players={samplePlayers}
        selectedRouteId={testRouteId}
      />
    );

    const ownerBadge = screen.getByTestId('selected-route-owner');
    expect(ownerBadge.textContent).toContain('Owned by Alice');
  });

  it('updates player score and remaining trains when route is claimed in game state', () => {
    let game = createGame('test_game');
    game = addPlayer(game, { playerId: 'p1', displayName: 'Player 1', color: '#e53e3e' });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Player 2', color: '#3182ce' });

    const routeId = 'route_atlanta_charleston_any'; // length 2
    const route = game.boardState.routes[routeId];
    const initialTrains = game.players.p1.trainsRemaining;
    const initialScore = game.players.p1.score;

    // Give player p1 cards to claim route
    const cardsToUse = [
      { id: 'c1', color: 'red' as const },
      { id: 'c2', color: 'red' as const },
    ];
    game = {
      ...game,
      players: {
        ...game.players,
        p1: {
          ...game.players.p1,
          trainCards: cardsToUse,
        },
      },
    };

    const updatedGame = claimRoute(game, 'p1', routeId, cardsToUse);

    // Verify game engine state
    const p1Updated = updatedGame.players.p1;
    expect(p1Updated.trainsRemaining).toBe(initialTrains - route.length);
    expect(p1Updated.score).toBe(initialScore + getPointsForRouteLength(route.length));
    expect(updatedGame.boardState.routes[routeId].ownerPlayerId).toBe('p1');
  });
});

describe('DevGameView interactive integration', () => {
  it('allows tapping route on board and claiming it', () => {
    render(<DevGameView />);

    // Add 2 players to activate game
    const input = screen.getByPlaceholderText('Player name...');
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByText('+ Add'));

    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByText('+ Add'));

    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);

    // Draw enough cards for Alice so she has matching cards in hand
    const drawButtons = screen.getAllByText('Draw 2 Cards');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(drawButtons[0]);
    }

    // Select route route_atlanta_charleston_any (length 2)
    const routeGroup = screen.getByTestId('route-group-route_atlanta_charleston_any');
    fireEvent.click(routeGroup);

    // Verify panel displays length 2 and color ANY
    expect(screen.getByTestId('selected-route-panel')).toBeDefined();
    expect(screen.getByTestId('selected-route-length').textContent).toContain('Length: 2');

    // Click Claim Route button on board panel
    const claimBtn = screen.getByTestId('board-claim-route-btn');
    fireEvent.click(claimBtn);

    // Click route on board again to view details
    fireEvent.click(routeGroup);

    // Verify route is claimed by Alice on board
    expect(screen.getByTestId('selected-route-owner').textContent).toContain('Owned by Alice');
    // Verify player score (2) and remaining trains (43 = 45 - 2) updated
    expect(screen.getByText('43')).toBeDefined();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });
});
