import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
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

// Firebase configuration using standard env variables or fallback defaults for project rails-between-us-2fd0b
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForRailsBetweenUsLocalDev',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'rails-between-us-2fd0b.firebaseapp.com',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'rails-between-us-2fd0b',
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || 'rails-between-us-2fd0b.firebasestorage.app',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '1029384756',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || '1:1029384756:web:abcdef123456',
};

let app: FirebaseApp;
let db: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} catch (e) {
  console.warn('Firebase initialization warning:', e);
}

export { app, db };

/**
 * Creates a new game in Firestore or returns initialized local game if Firestore unavailable.
 */
export async function createGameInFirestore(
  gameId: string,
  hostPlayer: { playerId: string; displayName: string; color: string }
): Promise<Game> {
  let game = createGame(gameId);
  game = addPlayer(game, hostPlayer);

  if (db) {
    const gameRef = doc(db, 'games', gameId);
    await setDoc(gameRef, game);
  }
  return game;
}

/**
 * Joins an existing game in Firestore.
 */
export async function joinGameInFirestore(
  gameId: string,
  playerInfo: { playerId: string; displayName: string; color: string }
): Promise<Game> {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const gameRef = doc(db, 'games', gameId);
  const snap = await getDoc(gameRef);

  if (!snap.exists()) {
    throw new Error(`Game ${gameId} does not exist.`);
  }

  const existingGame = snap.data() as Game;
  const updatedGame = addPlayer(existingGame, playerInfo);

  await setDoc(gameRef, updatedGame);
  return updatedGame;
}

/**
 * Updates a player's color in Firestore.
 */
export async function updatePlayerColorInFirestore(
  gameId: string,
  playerId: string,
  color: string
): Promise<Game> {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const gameRef = doc(db, 'games', gameId);
  const snap = await getDoc(gameRef);

  if (!snap.exists()) {
    throw new Error(`Game ${gameId} does not exist.`);
  }

  const existingGame = snap.data() as Game;
  const updatedGame = setPlayerColor(existingGame, playerId, color);

  await setDoc(gameRef, updatedGame);
  return updatedGame;
}

/**
 * Toggles a player's ready state in Firestore.
 */
export async function togglePlayerReadyInFirestore(
  gameId: string,
  playerId: string
): Promise<Game> {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const gameRef = doc(db, 'games', gameId);
  const snap = await getDoc(gameRef);

  if (!snap.exists()) {
    throw new Error(`Game ${gameId} does not exist.`);
  }

  const existingGame = snap.data() as Game;
  const updatedGame = togglePlayerReady(existingGame, playerId);

  await setDoc(gameRef, updatedGame);
  return updatedGame;
}

/**
 * Starts the game in Firestore (transitions phase from 'lobby' to 'playing').
 */
export async function startGameInFirestore(gameId: string): Promise<Game> {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const gameRef = doc(db, 'games', gameId);
  const snap = await getDoc(gameRef);

  if (!snap.exists()) {
    throw new Error(`Game ${gameId} does not exist.`);
  }

  const existingGame = snap.data() as Game;
  const updatedGame = engineStartGame(existingGame);

  await setDoc(gameRef, updatedGame);
  return updatedGame;
}

/**
 * Subscribes to real-time updates for a game in Firestore.
 */
export function subscribeToGame(
  gameId: string,
  onUpdate: (game: Game) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) {
    return () => {};
  }

  const gameRef = doc(db, 'games', gameId);
  return onSnapshot(
    gameRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as Game);
      }
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}
