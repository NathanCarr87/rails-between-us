// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lobby } from '../Lobby';
import { DevGameView } from '../DevGameView';
import { addPlayer, createGame } from '../../game/state/gameEngine';
import {
  clearPlayerSession,
  createGameInFirestore,
  getPlayerSession,
  joinGameInFirestore,
  savePlayerSession,
  startGameInFirestore,
  togglePlayerReadyInFirestore,
  updatePlayerColorInFirestore,
} from '../../game/services/firebase';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('Lobby Component UI', () => {
  it('renders initial setup form when game is null', () => {
    render(
      <Lobby
        game={null}
        localPlayerId=""
        onCreateGame={vi.fn()}
        onJoinGame={vi.fn()}
        onSelectColor={vi.fn()}
        onToggleReady={vi.fn()}
        onStartGame={vi.fn()}
      />
    );

    expect(screen.getByTestId('lobby-setup-container')).toBeDefined();
    expect(screen.getByTestId('player-name-input')).toBeDefined();
    expect(screen.getByTestId('game-id-input')).toBeDefined();
    expect(screen.getByTestId('create-game-btn')).toBeDefined();
    expect(screen.getByTestId('join-game-btn')).toBeDefined();
  });

  it('calls onCreateGame when Create New Game is clicked with specified or auto-generated game code', () => {
    const handleCreateGame = vi.fn();
    render(
      <Lobby
        game={null}
        localPlayerId=""
        onCreateGame={handleCreateGame}
        onJoinGame={vi.fn()}
        onSelectColor={vi.fn()}
        onToggleReady={vi.fn()}
        onStartGame={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('player-name-input'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('game-id-input'), { target: { value: 'ROOM1' } });
    fireEvent.click(screen.getByTestId('create-game-btn'));

    expect(handleCreateGame).toHaveBeenCalledWith('ROOM1', 'Alice', expect.any(String));
  });

  it('displays active lobby, lists players, handles ready status and color uniqueness', () => {
    let game = createGame('ROOM1');
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e', ready: true });
    game = addPlayer(game, { playerId: 'p2', displayName: 'Bob', color: '#3182ce', ready: false });

    render(
      <Lobby
        game={game}
        localPlayerId="p2"
        onCreateGame={vi.fn()}
        onJoinGame={vi.fn()}
        onSelectColor={vi.fn()}
        onToggleReady={vi.fn()}
        onStartGame={vi.fn()}
      />
    );

    expect(screen.getByTestId('lobby-active-container')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();

    // Check ready badges
    expect(screen.getByTestId('ready-status-p1').textContent).toBe('READY');
    expect(screen.getByTestId('ready-status-p2').textContent).toBe('NOT READY');

    // Check that Alice's color button is disabled for Bob
    const aliceColorBtn = screen.getByTestId('lobby-color-btn-#e53e3e') as HTMLButtonElement;
    expect(aliceColorBtn.disabled).toBe(true);

    // Bob's own color button is enabled
    const bobColorBtn = screen.getByTestId('lobby-color-btn-#3182ce') as HTMLButtonElement;
    expect(bobColorBtn.disabled).toBe(false);
  });

  it('allows copying the game code', () => {
    let game = createGame('CODE99');
    game = addPlayer(game, { playerId: 'p1', displayName: 'Alice', color: '#e53e3e', ready: true });

    render(
      <Lobby
        game={game}
        localPlayerId="p1"
        onCreateGame={vi.fn()}
        onJoinGame={vi.fn()}
        onSelectColor={vi.fn()}
        onToggleReady={vi.fn()}
        onStartGame={vi.fn()}
      />
    );

    expect(screen.getByTestId('game-code-display').textContent).toBe('CODE99');
    const copyBtn = screen.getByTestId('copy-code-btn');
    expect(copyBtn).toBeDefined();

    fireEvent.click(copyBtn);
    expect(screen.getByTestId('copy-code-btn').textContent).toContain('Copied');
  });
});

describe('Player Identity Persistence & Session Helpers', () => {
  it('saves, retrieves, and clears session in localStorage', () => {
    savePlayerSession('GAME_X', 'p_123', 'Nathan');

    const session = getPlayerSession('GAME_X');
    expect(session).toEqual({
      gameId: 'GAME_X',
      playerId: 'p_123',
      playerName: 'Nathan',
    });

    // Default session lookup without argument
    expect(getPlayerSession()).toEqual({
      gameId: 'GAME_X',
      playerId: 'p_123',
      playerName: 'Nathan',
    });

    clearPlayerSession('GAME_X');
    expect(getPlayerSession('GAME_X')).toBeNull();
  });
});

describe('Multiplayer Lobby Real-Time Sync & Error Handling Integration', () => {
  it('supports Device 1 and Device 2 joining the same lobby and real-time state sync', async () => {
    const gameId = 'SHARED1';

    // Device 1 creates game
    const game1 = await createGameInFirestore(gameId, {
      playerId: 'p1',
      displayName: 'Nathan',
      color: '#e53e3e', // Red
    });
    expect(game1.playerOrder).toEqual(['p1']);

    // Device 2 joins same game
    const game2 = await joinGameInFirestore(gameId, {
      playerId: 'p2',
      displayName: 'Player 2',
      color: '#3182ce', // Blue
    });

    expect(Object.keys(game2.players)).toHaveLength(2);
    expect(game2.players.p1.displayName).toBe('Nathan');
    expect(game2.players.p2.displayName).toBe('Player 2');

    // Device 1 marks ready
    await togglePlayerReadyInFirestore(gameId, 'p1');
    // Device 2 marks ready
    const readyGame = await togglePlayerReadyInFirestore(gameId, 'p2');

    expect(readyGame.players.p1.ready).toBe(true);
    expect(readyGame.players.p2.ready).toBe(true);

    // Host starts game
    const startedGame = await startGameInFirestore(gameId);
    expect(startedGame.phase).toBe('playing');
    expect(startedGame.status).toBe('active');
  });

  it('rejects joining non-existent game', async () => {
    await expect(
      joinGameInFirestore('NON_EXISTENT_CODE', {
        playerId: 'p2',
        displayName: 'Bob',
        color: '#3182ce',
      })
    ).rejects.toThrow('Game NON_EXISTENT_CODE does not exist.');
  });

  it('rejects selecting duplicate color in same game', async () => {
    const gameId = 'COLOR_TEST';
    await createGameInFirestore(gameId, {
      playerId: 'p1',
      displayName: 'Alice',
      color: '#e53e3e', // Red
    });

    await joinGameInFirestore(gameId, {
      playerId: 'p2',
      displayName: 'Bob',
      color: '#3182ce', // Blue
    });

    // Bob attempts to change color to Red (taken by Alice)
    await expect(
      updatePlayerColorInFirestore(gameId, 'p2', '#e53e3e')
    ).rejects.toThrow('already chosen by another player');
  });

  it('rejects starting game with fewer than 2 players or when players are not ready', async () => {
    const gameId = 'NOT_READY_TEST';
    await createGameInFirestore(gameId, {
      playerId: 'p1',
      displayName: 'Alice',
      color: '#e53e3e',
    });

    // 1 player only -> cannot start
    await expect(startGameInFirestore(gameId)).rejects.toThrow('At least 2 players are required');

    // 2 players but not ready -> cannot start
    await joinGameInFirestore(gameId, {
      playerId: 'p2',
      displayName: 'Bob',
      color: '#3182ce',
    });

    await expect(startGameInFirestore(gameId)).rejects.toThrow('All players must be ready');
  });
});

describe('DevGameView Full Flow Integration', () => {
  it('renders setup, creates game, transitions through lobby to playing phase', async () => {
    render(<DevGameView />);

    expect(screen.getByTestId('lobby-setup-container')).toBeDefined();

    // Create game
    fireEvent.change(screen.getByTestId('player-name-input'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('game-id-input'), { target: { value: 'FLOW_ROOM' } });
    fireEvent.click(screen.getByTestId('create-game-btn'));

    // Wait for active lobby to render
    const activeLobby = await screen.findByTestId('lobby-active-container');
    expect(activeLobby).toBeDefined();

    // Add second player to same game in Firestore
    await joinGameInFirestore('FLOW_ROOM', {
      playerId: 'p2',
      displayName: 'Bob',
      color: '#3182ce',
    });

    // Toggle ready for p1 in UI
    const readyBtn = screen.getByTestId('toggle-ready-btn');
    fireEvent.click(readyBtn);

    // Toggle ready for p2 in Firestore
    await togglePlayerReadyInFirestore('FLOW_ROOM', 'p2');

    // Wait for Start Game button to be enabled and click it
    await waitFor(() => {
      const startBtn = screen.getByTestId('start-game-btn') as HTMLButtonElement;
      expect(startBtn.disabled).toBe(false);
    });

    const startBtn = screen.getByTestId('start-game-btn');
    fireEvent.click(startBtn);

    // Wait for transition to playing phase container
    const inGameContainer = await screen.findByTestId('in-game-container');
    expect(inGameContainer).toBeDefined();
    expect(screen.queryByTestId('route-select-dropdown')).toBeNull();
  });
});
