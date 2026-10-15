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

describe('GameBoard zoom controls and viewBox state', () => {
  const sampleBoardState = {
    cities: DEFAULT_CITIES,
    routes: DEFAULT_ROUTES,
  };

  const samplePlayers = {
    player_1: {
      playerId: 'player_1',
      displayName: 'Alice',
      color: '#e53e3e',
      ready: true,
      trainCards: [],
      destinationTickets: [],
      claimedRoutes: [],
      trainsRemaining: 45,
      score: 0,
    },
  };

  it('renders zoom controls and sets default 1.25x zoom centered viewBox', () => {
    const { container } = render(
      <GameBoard boardState={sampleBoardState} players={samplePlayers} />
    );

    const zoomControls = screen.getByTestId('map-zoom-controls');
    expect(zoomControls).toBeDefined();

    const zoomInBtn = screen.getByTestId('map-zoom-in');
    const zoomOutBtn = screen.getByTestId('map-zoom-out');
    const zoomResetBtn = screen.getByTestId('map-zoom-reset');

    expect(zoomInBtn).toBeDefined();
    expect(zoomOutBtn).toBeDefined();
    expect(zoomResetBtn).toBeDefined();

    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    // Default zoom scale = 1.25 -> viewBox "100 67 800 536"
    expect(svg?.getAttribute('viewBox')).toBe('100 67 800 536');
  });

  it('zooms in when Zoom In (+) is clicked', () => {
    const { container } = render(
      <GameBoard boardState={sampleBoardState} players={samplePlayers} />
    );

    const zoomInBtn = screen.getByTestId('map-zoom-in');
    fireEvent.click(zoomInBtn);

    const svg = container.querySelector('svg');
    const viewBox = svg?.getAttribute('viewBox');
    expect(viewBox).toBeDefined();

    const [vx, vy, vw, vh] = viewBox!.split(' ').map(Number);
    // Increased zoom scale means smaller viewBox dimensions (vw < 800, vh < 536)
    expect(vw).toBeLessThan(800);
    expect(vh).toBeLessThan(536);
    expect(vx).toBeGreaterThanOrEqual(0);
    expect(vy).toBeGreaterThanOrEqual(0);
  });

  it('zooms out when Zoom Out (−) is clicked', () => {
    const { container } = render(
      <GameBoard boardState={sampleBoardState} players={samplePlayers} />
    );

    const zoomOutBtn = screen.getByTestId('map-zoom-out');
    fireEvent.click(zoomOutBtn);

    const svg = container.querySelector('svg');
    const viewBox = svg?.getAttribute('viewBox');
    expect(viewBox).toBeDefined();

    const [_vx, _vy, vw, vh] = viewBox!.split(' ').map(Number);
    // Decreased zoom scale means larger viewBox dimensions (vw > 800, vh > 536)
    expect(vw).toBeGreaterThan(800);
    expect(vh).toBeGreaterThan(536);
  });

  it('resets to default 1.25x zoom when Reset is clicked after zooming', () => {
    const { container } = render(
      <GameBoard boardState={sampleBoardState} players={samplePlayers} />
    );

    const zoomInBtn = screen.getByTestId('map-zoom-in');
    const zoomResetBtn = screen.getByTestId('map-zoom-reset');

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);

    fireEvent.click(zoomResetBtn);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('100 67 800 536');
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
      ready: true,
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
    game = { ...game, phase: 'playing', status: 'active', currentPlayerId: 'p1' };

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
  it('renders lobby and transitions to playing phase when started', async () => {
    render(<DevGameView />);

    // Initial setup form in lobby
    expect(screen.getByTestId('lobby-setup-container')).toBeDefined();

    // Create game as Alice
    fireEvent.change(screen.getByTestId('player-name-input'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('game-id-input'), { target: { value: 'dev_game_1' } });
    fireEvent.click(screen.getByTestId('create-game-btn'));

    // Active lobby rendered
    expect(await screen.findByTestId('lobby-active-container')).toBeDefined();
  });
});
