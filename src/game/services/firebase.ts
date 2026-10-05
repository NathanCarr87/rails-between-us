import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  runTransaction,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Game } from '../model/types';
import {
  addPlayer,
  createGame,
  setPlayerColor,
  startGame as engineStartGame,
  togglePlayerReady,
} from '../state/gameEngine';

// Firebase configuration using standard env variables for project rails-between-us-2fd0b
const apiKey = import.meta.env?.VITE_FIREBASE_API_KEY || '';
const authDomain = import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'rails-between-us-2fd0b.firebaseapp.com';
const projectId = import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'rails-between-us-2fd0b';
const storageBucket = import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || 'rails-between-us-2fd0b.firebasestorage.app';
const messagingSenderId = import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
const appId = import.meta.env?.VITE_FIREBASE_APP_ID || '';

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

// Avoid connecting to Firebase if running in unit tests or if API key is not configured
const isTestEnv = import.meta.env?.MODE === 'test';

if (!isTestEnv && apiKey) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
  } catch (e) {
    console.warn('Firebase initialization warning:', e);
  }
}

export { app, db };

// In-memory cache & listeners for immediate sync & offline/test support
const inMemoryGames = new Map<string, Game>();
const inMemoryListeners = new Map<string, Set<(game: Game | null) => void>>();

function saveLocalGame(gameId: string, game: Game | null): void {
  try {
    const key = `rails_game_${gameId}`;
    const newValue = game ? JSON.stringify(game) : null;
    if (newValue) {
      localStorage.setItem(key, newValue);
    } else {
      localStorage.removeItem(key);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue,
        })
      );
    }
  } catch (err) {
    console.warn('Failed to save game to localStorage', err);
  }
}

function getLocalGame(gameId: string): Game | null {
  try {
    const data = localStorage.getItem(`rails_game_${gameId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('rails_game_')) {
      const gameId = event.key.replace('rails_game_', '');
      try {
        const game = event.newValue ? (JSON.parse(event.newValue) as Game) : null;
        if (game) {
          inMemoryGames.set(gameId, game);
        } else {
          inMemoryGames.delete(gameId);
        }
        notifyMemoryListeners(gameId, game);
      } catch {
        // ignore parse errors
      }
    }
  });
}

function notifyMemoryListeners(gameId: string, game: Game | null): void {
  const listeners = inMemoryListeners.get(gameId);
  if (listeners) {
    listeners.forEach((cb) => cb(game));
  }
}

/**
 * Generates a clean 4-character short code for easy game sharing.
 */
export function generateGameCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Saves local player identity for a game in localStorage.
 */
export function savePlayerSession(gameId: string, playerId: string, playerName: string): void {
  try {
    localStorage.setItem(`rails_session_${gameId}`, JSON.stringify({ playerId, playerName, gameId }));
    localStorage.setItem('rails_last_game_id', gameId);
  } catch (err) {
    console.warn('Failed to save session to localStorage', err);
  }
}

/**
 * Retrieves local player session for a given gameId or last active gameId.
 */
export function getPlayerSession(gameId?: string): { playerId: string; playerName: string; gameId: string } | null {
  try {
    const idToUse = gameId || localStorage.getItem('rails_last_game_id');
    if (!idToUse) return null;
    const data = localStorage.getItem(`rails_session_${idToUse}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Clears local player session.
 */
export function clearPlayerSession(gameId?: string): void {
  try {
    if (gameId) {
      localStorage.removeItem(`rails_session_${gameId}`);
    }
    localStorage.removeItem('rails_last_game_id');
  } catch (err) {
    console.warn('Failed to clear session from localStorage', err);
  }
}

/**
 * Creates a new game in Firestore.
 */
export async function createGameInFirestore(
  gameId: string,
  hostPlayer: { playerId: string; displayName: string; color: string }
): Promise<Game> {
  let initialGame = createGame(gameId);
  initialGame = addPlayer(initialGame, hostPlayer);

  if (db) {
    try {
      const gameRef = doc(db, 'games', gameId);
      const snap = await getDoc(gameRef);

      if (snap.exists()) {
        const existingGame = snap.data() as Game;
        if (existingGame.phase === 'playing') {
          throw new Error(`Game ${gameId} has already started.`);
        }
      }

      await setDoc(gameRef, initialGame);
    } catch (err) {
      // Re-throw errors so creation fails when permissions or network fail
      console.error('Firestore setDoc error creating game:', err);
      throw err;
    }
  }

  inMemoryGames.set(gameId, initialGame);
  saveLocalGame(gameId, initialGame);
  notifyMemoryListeners(gameId, initialGame);

  return initialGame;
}

/**
 * Joins an existing game in Firestore using an atomic transaction.
 */
export async function joinGameInFirestore(
  gameId: string,
  playerInfo: { playerId: string; displayName: string; color: string }
): Promise<Game> {
  let updatedGame: Game;

  if (db) {
    try {
      const gameRef = doc(db, 'games', gameId);
      updatedGame = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);

        if (!snap.exists()) {
          throw new Error(`Game ${gameId} does not exist.`);
        }

        const existingGame = snap.data() as Game;

        if (existingGame.phase !== 'lobby') {
          throw new Error(`Game ${gameId} has already started.`);
        }

        if (existingGame.players[playerInfo.playerId]) {
          return existingGame;
        }

        const gameWithPlayer = addPlayer(existingGame, playerInfo);
        transaction.set(gameRef, gameWithPlayer);
        return gameWithPlayer;
      });
    } catch (err) {
      console.error('Firestore transaction error joining game:', err);
      throw err;
    }
  } else {
    const memGame = inMemoryGames.get(gameId) || getLocalGame(gameId);
    if (!memGame) {
      throw new Error(`Game ${gameId} does not exist.`);
    }
    if (memGame.phase !== 'lobby') {
      throw new Error(`Game ${gameId} has already started.`);
    }
    if (memGame.players[playerInfo.playerId]) {
      updatedGame = memGame;
    } else {
      updatedGame = addPlayer(memGame, playerInfo);
    }
  }

  inMemoryGames.set(gameId, updatedGame);
  saveLocalGame(gameId, updatedGame);
  notifyMemoryListeners(gameId, updatedGame);
  return updatedGame;
}

/**
 * Updates a player's color in Firestore using an atomic transaction.
 */
export async function updatePlayerColorInFirestore(
  gameId: string,
  playerId: string,
  color: string
): Promise<Game> {
  let updatedGame: Game;

  if (db) {
    try {
      const gameRef = doc(db, 'games', gameId);
      updatedGame = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);

        if (!snap.exists()) {
          throw new Error(`Game ${gameId} does not exist.`);
        }

        const existingGame = snap.data() as Game;

        if (existingGame.phase !== 'lobby') {
          throw new Error(`Game ${gameId} has already started.`);
        }

        const gameWithColor = setPlayerColor(existingGame, playerId, color);
        transaction.set(gameRef, gameWithColor);
        return gameWithColor;
      });
    } catch (err) {
      console.error('Firestore transaction error updating player color:', err);
      throw err;
    }
  } else {
    const memGame = inMemoryGames.get(gameId) || getLocalGame(gameId);
    if (!memGame) {
      throw new Error(`Game ${gameId} does not exist.`);
    }
    updatedGame = setPlayerColor(memGame, playerId, color);
  }

  inMemoryGames.set(gameId, updatedGame);
  saveLocalGame(gameId, updatedGame);
  notifyMemoryListeners(gameId, updatedGame);
  return updatedGame;
}

/**
 * Toggles a player's ready state in Firestore using an atomic transaction.
 */
export async function togglePlayerReadyInFirestore(
  gameId: string,
  playerId: string
): Promise<Game> {
  let updatedGame: Game;

  if (db) {
    try {
      const gameRef = doc(db, 'games', gameId);
      updatedGame = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);

        if (!snap.exists()) {
          throw new Error(`Game ${gameId} does not exist.`);
        }

        const existingGame = snap.data() as Game;
        const gameWithReady = togglePlayerReady(existingGame, playerId);
        transaction.set(gameRef, gameWithReady);
        return gameWithReady;
      });
    } catch (err) {
      console.error('Firestore transaction error toggling player ready:', err);
      throw err;
    }
  } else {
    const memGame = inMemoryGames.get(gameId) || getLocalGame(gameId);
    if (!memGame) {
      throw new Error(`Game ${gameId} does not exist.`);
    }
    updatedGame = togglePlayerReady(memGame, playerId);
  }

  inMemoryGames.set(gameId, updatedGame);
  saveLocalGame(gameId, updatedGame);
  notifyMemoryListeners(gameId, updatedGame);
  return updatedGame;
}

/**
 * Starts the game in Firestore using an atomic transaction.
 */
export async function startGameInFirestore(gameId: string): Promise<Game> {
  let updatedGame: Game;

  if (db) {
    try {
      const gameRef = doc(db, 'games', gameId);
      updatedGame = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(gameRef);

        if (!snap.exists()) {
          throw new Error(`Game ${gameId} does not exist.`);
        }

        const existingGame = snap.data() as Game;

        if (existingGame.phase !== 'lobby') {
          return existingGame;
        }

        const playerList = Object.values(existingGame.players);
        if (playerList.length < 2) {
          throw new Error('At least 2 players are required to start the game.');
        }

        if (!playerList.every((p) => p.ready)) {
          throw new Error('All players must be ready to start the game.');
        }

        const startedGame = engineStartGame(existingGame);
        transaction.set(gameRef, startedGame);
        return startedGame;
      });
    } catch (err) {
      console.error('Firestore transaction error starting game:', err);
      throw err;
    }
  } else {
    const memGame = inMemoryGames.get(gameId) || getLocalGame(gameId);
    if (!memGame) {
      throw new Error(`Game ${gameId} does not exist.`);
    }
    const playerList = Object.values(memGame.players);
    if (playerList.length < 2) {
      throw new Error('At least 2 players are required to start the game.');
    }
    if (!playerList.every((p) => p.ready)) {
      throw new Error('All players must be ready to start the game.');
    }
    updatedGame = engineStartGame(memGame);
  }

  inMemoryGames.set(gameId, updatedGame);
  saveLocalGame(gameId, updatedGame);
  notifyMemoryListeners(gameId, updatedGame);
  return updatedGame;
}

/**
 * Subscribes to real-time updates for a game in Firestore.
 */
export function subscribeToGame(
  gameId: string,
  onUpdate: (game: Game | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!inMemoryListeners.has(gameId)) {
    inMemoryListeners.set(gameId, new Set());
  }
  const listenerSet = inMemoryListeners.get(gameId)!;
  listenerSet.add(onUpdate);

  const existingMemGame = inMemoryGames.get(gameId) || getLocalGame(gameId);
  if (existingMemGame) {
    onUpdate(existingMemGame);
  }

  let firestoreUnsub: Unsubscribe = () => {};

  if (db) {
    try {
      const gameRef = doc(db, 'games', gameId);
      firestoreUnsub = onSnapshot(
        gameRef,
        (snap) => {
          if (snap.exists()) {
            const g = snap.data() as Game;
            inMemoryGames.set(gameId, g);
            saveLocalGame(gameId, g);
            onUpdate(g);
          } else {
            onUpdate(null);
          }
        },
        (err) => {
          if (onError) onError(err);
        }
      );
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
  }

  return () => {
    listenerSet.delete(onUpdate);
    if (listenerSet.size === 0) {
      inMemoryListeners.delete(gameId);
    }
    firestoreUnsub();
  };
}
