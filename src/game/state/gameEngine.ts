import type { DestinationTicket, Game, Player, PlayerAction, Route, TrainCard } from '../model/types';
export type { DestinationTicket } from '../model/types';
import {
  createInitialBoard,
  createSampleDestinationDeck,
  createSampleTrainDeck,
  getPointsForRouteLength,
  INITIAL_TRAINS_PER_PLAYER,
  shuffleDeck,
} from '../rules/defaults';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

export const PLAYER_COLORS = [
  '#e53e3e', // Red
  '#3182ce', // Blue
  '#38a169', // Green
  '#d69e2e', // Yellow
  '#805ad5', // Purple
  '#dd6b20', // Orange
  '#2d3748', // Black
  '#edf2f7', // White / Silver
];

export function checkAndRefreshFaceUpLocomotives(game: Game): Game {
  let faceUp = [...game.faceUpTrainCards];
  let deck = [...game.trainCardDeck];
  let discard = [...game.trainCardDiscardPile];

  let locoCount = faceUp.filter((c) => c.color === 'locomotive').length;

  while (locoCount >= 3) {
    const totalAvailableCards = faceUp.length + deck.length + discard.length;
    if (totalAvailableCards < 5) {
      break;
    }

    discard = [...discard, ...faceUp];
    faceUp = [];

    if (deck.length < 5 && discard.length > 0) {
      deck = [...deck, ...shuffleDeck(discard)];
      discard = [];
    }

    while (faceUp.length < 5 && (deck.length > 0 || discard.length > 0)) {
      if (deck.length === 0 && discard.length > 0) {
        deck = shuffleDeck(discard);
        discard = [];
      }
      const card = deck.pop();
      if (card) faceUp.push(card);
    }

    const newLocoCount = faceUp.filter((c) => c.color === 'locomotive').length;
    if (newLocoCount >= 3 && deck.length === 0 && discard.length === 0) {
      break;
    }
    locoCount = newLocoCount;
  }

  return {
    ...game,
    faceUpTrainCards: faceUp,
    trainCardDeck: deck,
    trainCardDiscardPile: discard,
  };
}

export function createGame(gameId: string = 'game_' + Date.now()): Game {
  const now = Date.now();
  return {
    gameId,
    phase: 'lobby',
    status: 'waiting',
    players: {},
    playerOrder: [],
    currentPlayerId: null,
    turnNumber: 0,
    boardState: createInitialBoard(),
    trainCardDeck: createSampleTrainDeck(),
    faceUpTrainCards: [],
    trainCardDiscardPile: [],
    destinationTicketDeck: createSampleDestinationDeck(),
    destinationTicketDiscardPile: [],
    cardsDrawnThisTurn: 0,
    isFinalRound: false,
    finalRoundTriggeredBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function isColorTaken(game: Game, color: string, excludingPlayerId?: string): boolean {
  return Object.values(game.players).some(
    (p) => p.playerId !== excludingPlayerId && p.color.toLowerCase() === color.toLowerCase()
  );
}

export function addPlayer(
  game: Game,
  playerInfo: { playerId: string; displayName: string; color: string; ready?: boolean }
): Game {
  if (game.playerOrder.length >= MAX_PLAYERS) {
    throw new Error(`Cannot add player: Maximum limit of ${MAX_PLAYERS} players reached.`);
  }

  if (game.players[playerInfo.playerId]) {
    throw new Error(`Player with ID ${playerInfo.playerId} already exists.`);
  }

  if (isColorTaken(game, playerInfo.color)) {
    throw new Error(`Color ${playerInfo.color} is already chosen by another player.`);
  }

  const newPlayer: Player = {
    playerId: playerInfo.playerId,
    displayName: playerInfo.displayName,
    color: playerInfo.color,
    ready: playerInfo.ready ?? false,
    trainCards: [],
    destinationTickets: [],
    claimedRoutes: [],
    trainsRemaining: INITIAL_TRAINS_PER_PLAYER,
    score: 0,
  };

  const updatedPlayerOrder = [...game.playerOrder, playerInfo.playerId];

  return {
    ...game,
    players: {
      ...game.players,
      [playerInfo.playerId]: newPlayer,
    },
    playerOrder: updatedPlayerOrder,
    updatedAt: Date.now(),
  };
}

export function setPlayerColor(game: Game, playerId: string, color: string): Game {
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} not found.`);
  }

  if (isColorTaken(game, color, playerId)) {
    throw new Error(`Color ${color} is already chosen by another player.`);
  }

  return {
    ...game,
    players: {
      ...game.players,
      [playerId]: {
        ...player,
        color,
      },
    },
    updatedAt: Date.now(),
  };
}

export function togglePlayerReady(game: Game, playerId: string): Game {
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} not found.`);
  }

  return {
    ...game,
    players: {
      ...game.players,
      [playerId]: {
        ...player,
        ready: !player.ready,
      },
    },
    updatedAt: Date.now(),
  };
}

export function startGame(game: Game): Game {
  if (game.playerOrder.length < MIN_PLAYERS) {
    throw new Error(`At least ${MIN_PLAYERS} players are required to start the game.`);
  }

  const currentPlayerId = game.currentPlayerId ?? game.playerOrder[0];
  const turnNumber = game.turnNumber === 0 ? 1 : game.turnNumber;

  let currentTrainDeck = [...game.trainCardDeck];
  let currentTicketDeck = [...game.destinationTicketDeck];
  const updatedPlayers: Record<string, Player> = { ...game.players };

  for (const pid of game.playerOrder) {
    const p = updatedPlayers[pid];
    if (!p) continue;

    let trainCards = [...p.trainCards];
    if (trainCards.length === 0) {
      for (let i = 0; i < 4; i++) {
        const card = currentTrainDeck.pop();
        if (card) trainCards.push(card);
      }
    }

    let pendingTickets = p.pendingDestinationTickets ? [...p.pendingDestinationTickets] : [];
    if (pendingTickets.length === 0 && p.destinationTickets.length === 0) {
      for (let i = 0; i < 3; i++) {
        const t = currentTicketDeck.pop();
        if (t) pendingTickets.push(t);
      }
    }

    updatedPlayers[pid] = {
      ...p,
      trainCards,
      pendingDestinationTickets: pendingTickets,
      pendingTicketsMinKeep: Math.min(2, pendingTickets.length),
      pendingTicketsFromTurn: false,
      destinationTickets: p.destinationTickets ?? [],
    };
  }

  let faceUpCards = [...game.faceUpTrainCards];
  if (faceUpCards.length === 0) {
    for (let i = 0; i < 5; i++) {
      const card = currentTrainDeck.pop();
      if (card) faceUpCards.push(card);
    }
  }

  let startedGame: Game = {
    ...game,
    phase: 'playing',
    status: 'active',
    currentPlayerId,
    turnNumber,
    players: updatedPlayers,
    trainCardDeck: currentTrainDeck,
    faceUpTrainCards: faceUpCards,
    destinationTicketDeck: currentTicketDeck,
    cardsDrawnThisTurn: 0,
    updatedAt: Date.now(),
  };

  return checkAndRefreshFaceUpLocomotives(startedGame);
}

export function calculateLongestContinuousPath(
  claimedRouteIds: string[],
  routes: Record<string, Route>
): number {
  if (claimedRouteIds.length === 0) return 0;

  interface Edge {
    edgeId: string;
    toCity: string;
    length: number;
  }

  const adj = new Map<string, Edge[]>();

  for (const routeId of claimedRouteIds) {
    const route = routes[routeId];
    if (!route) continue;

    if (!adj.has(route.cityA)) adj.set(route.cityA, []);
    if (!adj.has(route.cityB)) adj.set(route.cityB, []);

    adj.get(route.cityA)!.push({ edgeId: route.routeId, toCity: route.cityB, length: route.length });
    adj.get(route.cityB)!.push({ edgeId: route.routeId, toCity: route.cityA, length: route.length });
  }

  let maxPathLength = 0;

  function dfs(currentCity: string, visitedEdges: Set<string>, currentLength: number) {
    if (currentLength > maxPathLength) {
      maxPathLength = currentLength;
    }

    const edges = adj.get(currentCity);
    if (!edges) return;

    for (const edge of edges) {
      if (!visitedEdges.has(edge.edgeId)) {
        visitedEdges.add(edge.edgeId);
        dfs(edge.toCity, visitedEdges, currentLength + edge.length);
        visitedEdges.delete(edge.edgeId);
      }
    }
  }

  for (const startCity of adj.keys()) {
    dfs(startCity, new Set<string>(), 0);
  }

  return maxPathLength;
}

export function calculateLongestPathBonuses(
  players: Record<string, Player>,
  routes: Record<string, Route>
): Record<string, { length: number; bonus: number }> {
  const playerPaths: Record<string, number> = {};
  let maxLength = 0;

  for (const pid of Object.keys(players)) {
    const p = players[pid];
    const len = calculateLongestContinuousPath(p.claimedRoutes, routes);
    playerPaths[pid] = len;
    if (len > maxLength) {
      maxLength = len;
    }
  }

  const result: Record<string, { length: number; bonus: number }> = {};
  for (const pid of Object.keys(players)) {
    const len = playerPaths[pid] || 0;
    const bonus = maxLength > 0 && len === maxLength ? 10 : 0;
    result[pid] = { length: len, bonus };
  }

  return result;
}

export function calculateFinalGameScores(game: Game): Record<string, Player> {
  const routes = game.boardState.routes;
  const longestPathResults = calculateLongestPathBonuses(game.players, routes);
  const updatedPlayers: Record<string, Player> = {};

  for (const pid of game.playerOrder) {
    const p = game.players[pid];
    if (!p) continue;

    let routePoints = 0;
    for (const routeId of p.claimedRoutes) {
      const route = routes[routeId];
      if (route) {
        routePoints += getPointsForRouteLength(route.length);
      }
    }

    const destinationTicketPoints = calculateDestinationTicketScore(
      p.destinationTickets,
      p.claimedRoutes,
      routes
    );

    let completedTicketsCount = 0;
    for (const ticket of p.destinationTickets) {
      if (isTicketCompleted(ticket, p.claimedRoutes, routes)) {
        completedTicketsCount++;
      }
    }

    const longestPathInfo = longestPathResults[pid] || { length: 0, bonus: 0 };

    const finalScore = routePoints + destinationTicketPoints + longestPathInfo.bonus;

    updatedPlayers[pid] = {
      ...p,
      score: finalScore,
      scoreBreakdown: {
        routePoints,
        destinationTicketPoints,
        completedTicketsCount,
        longestPathLength: longestPathInfo.length,
        longestPathBonus: longestPathInfo.bonus,
        finalScore,
      },
    };
  }

  return updatedPlayers;
}

/**
 * Compares two players to determine winner order according to official tie-breaker rules:
 * 1. Total score (highest)
 * 2. Completed Destination Tickets count (highest)
 * 3. Longest Continuous Path length (highest)
 */
export function comparePlayersForWinner(a: Player, b: Player): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const aCompleted = a.scoreBreakdown?.completedTicketsCount ?? 0;
  const bCompleted = b.scoreBreakdown?.completedTicketsCount ?? 0;
  if (bCompleted !== aCompleted) {
    return bCompleted - aCompleted;
  }

  const aLongest = a.scoreBreakdown?.longestPathLength ?? 0;
  const bLongest = b.scoreBreakdown?.longestPathLength ?? 0;
  if (bLongest !== aLongest) {
    return bLongest - aLongest;
  }

  return 0;
}

export function advanceTurn(game: Game): Game {
  if (game.phase !== 'playing' || game.status === 'completed' || game.playerOrder.length === 0) {
    return game;
  }

  const wasAlreadyFinalRound = game.isFinalRound ?? false;
  let isFinalRound = wasAlreadyFinalRound;
  let finalRoundTriggeredBy = game.finalRoundTriggeredBy ?? null;

  // Check if current active player triggers final round (trainsRemaining <= 2)
  if (!isFinalRound && game.currentPlayerId) {
    const activePlayer = game.players[game.currentPlayerId];
    if (activePlayer && activePlayer.trainsRemaining <= 2) {
      isFinalRound = true;
      finalRoundTriggeredBy = game.currentPlayerId;
    }
  }

  // If the turn that just ended was taken during the final round, AND it was played by the player who triggered the final round
  if (wasAlreadyFinalRound && game.currentPlayerId === finalRoundTriggeredBy) {
    const finalPlayers = calculateFinalGameScores(game);

    return {
      ...game,
      phase: 'finished',
      status: 'completed',
      currentPlayerId: null,
      cardsDrawnThisTurn: 0,
      isFinalRound: true,
      finalRoundTriggeredBy,
      players: finalPlayers,
      turnNumber: game.turnNumber + 1,
      updatedAt: Date.now(),
    };
  }

  const currentIndex = game.currentPlayerId ? game.playerOrder.indexOf(game.currentPlayerId) : -1;
  const nextIndex = (currentIndex + 1) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[nextIndex];

  return {
    ...game,
    currentPlayerId: nextPlayerId,
    turnNumber: game.turnNumber + 1,
    cardsDrawnThisTurn: 0,
    isFinalRound,
    finalRoundTriggeredBy,
    updatedAt: Date.now(),
  };
}

export function calculateRouteCost(route: Route) {
  return {
    length: route.length,
    colorRequirement: route.colorRequirement,
  };
}

export function canClaimRoute(
  game: Game,
  playerId: string,
  routeId: string,
  cardsToUse: TrainCard[]
): { allowed: boolean; reason?: string } {
  if (game.phase === 'finished' || game.status === 'completed') {
    return { allowed: false, reason: 'Game is finished.' };
  }

  const player = game.players[playerId];
  if (!player) {
    return { allowed: false, reason: 'Player does not exist.' };
  }

  if (game.currentPlayerId !== playerId) {
    return { allowed: false, reason: 'Not this player turn.' };
  }

  if (player.pendingDestinationTickets && player.pendingDestinationTickets.length > 0) {
    return { allowed: false, reason: 'Must complete destination ticket selection first.' };
  }

  const route = game.boardState.routes[routeId];
  if (!route) {
    return { allowed: false, reason: 'Route does not exist.' };
  }

  if (route.ownerPlayerId !== null) {
    return { allowed: false, reason: 'Route is already claimed.' };
  }

  if (player.trainsRemaining < route.length) {
    return { allowed: false, reason: 'Not enough remaining train pieces.' };
  }

  if (cardsToUse.length !== route.length) {
    return { allowed: false, reason: `Exact card count matching route length (${route.length}) is required.` };
  }

  // Check card colors
  const primaryColorCards = cardsToUse.filter((c) => c.color !== 'locomotive');
  if (primaryColorCards.length > 0) {
    const chosenColor = primaryColorCards[0].color;
    const allSameColorOrLoco = primaryColorCards.every((c) => c.color === chosenColor);
    if (!allSameColorOrLoco) {
      return { allowed: false, reason: 'Cards used must be of the same color or locomotive.' };
    }

    if (route.colorRequirement !== 'any' && chosenColor !== route.colorRequirement) {
      return { allowed: false, reason: `Route requires ${route.colorRequirement} cards.` };
    }
  }

  return { allowed: true };
}

export function claimRoute(
  game: Game,
  playerId: string,
  routeId: string,
  cardsToUse: TrainCard[]
): Game {
  const validation = canClaimRoute(game, playerId, routeId, cardsToUse);
  if (!validation.allowed) {
    throw new Error(`Cannot claim route: ${validation.reason}`);
  }

  const player = game.players[playerId];
  const route = game.boardState.routes[routeId];
  const pointsEarned = getPointsForRouteLength(route.length);

  // Remove used cards from player hand
  const usedCardIds = new Set(cardsToUse.map((c) => c.id));
  const remainingPlayerCards = player.trainCards.filter((c) => !usedCardIds.has(c.id));

  const updatedPlayer: Player = {
    ...player,
    trainCards: remainingPlayerCards,
    claimedRoutes: [...player.claimedRoutes, routeId],
    trainsRemaining: player.trainsRemaining - route.length,
    score: player.score + pointsEarned,
  };

  const updatedRoute: Route = {
    ...route,
    ownerPlayerId: playerId,
  };

  const updatedDiscardPile = [...game.trainCardDiscardPile, ...cardsToUse];

  const updatedGame: Game = {
    ...game,
    players: {
      ...game.players,
      [playerId]: updatedPlayer,
    },
    boardState: {
      ...game.boardState,
      routes: {
        ...game.boardState.routes,
        [routeId]: updatedRoute,
      },
    },
    trainCardDiscardPile: updatedDiscardPile,
    updatedAt: Date.now(),
  };

  return advanceTurn(updatedGame);
}

export function discardTrainCards(
  game: Game,
  playerId: string,
  cardsToDiscard: TrainCard[]
): Game {
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  const discardCardIds = new Set(cardsToDiscard.map((c) => c.id));
  const updatedPlayerCards = player.trainCards.filter((c) => !discardCardIds.has(c.id));

  // Verify that all cards to discard were in the player's hand
  if (player.trainCards.length - updatedPlayerCards.length !== cardsToDiscard.length) {
    throw new Error('Some specified cards were not found in player hand.');
  }

  const updatedPlayer: Player = {
    ...player,
    trainCards: updatedPlayerCards,
  };

  return {
    ...game,
    players: {
      ...game.players,
      [playerId]: updatedPlayer,
    },
    trainCardDiscardPile: [...game.trainCardDiscardPile, ...cardsToDiscard],
    updatedAt: Date.now(),
  };
}

export function drawSingleTrainCard(
  game: Game,
  playerId: string,
  source: 'deck' | 'faceUp',
  faceUpIndex?: number
): Game {
  if (game.phase === 'finished' || game.status === 'completed') {
    throw new Error('Cannot draw train cards: Game is finished.');
  }

  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  if (game.currentPlayerId !== null && game.currentPlayerId !== playerId) {
    throw new Error(`Cannot draw train cards: Not player ${playerId}'s turn.`);
  }

  if (player.pendingDestinationTickets && player.pendingDestinationTickets.length > 0) {
    throw new Error('Must complete destination ticket selection first.');
  }

  const cardsDrawn = game.cardsDrawnThisTurn || 0;
  if (cardsDrawn >= 2) {
    throw new Error(`Player ${playerId} has already drawn 2 cards this turn.`);
  }

  let deck = [...game.trainCardDeck];
  let discard = [...game.trainCardDiscardPile];
  let faceUp = [...game.faceUpTrainCards];

  function popFromDeck(): TrainCard | null {
    if (deck.length === 0) {
      if (discard.length === 0) {
        return null;
      }
      deck = shuffleDeck(discard);
      discard = [];
    }
    return deck.pop() ?? null;
  }

  let drawnCard: TrainCard | null = null;

  if (source === 'faceUp') {
    if (faceUpIndex === undefined || faceUpIndex < 0 || faceUpIndex >= faceUp.length) {
      throw new Error(`Invalid face-up card index: ${faceUpIndex}`);
    }

    const targetCard = faceUp[faceUpIndex];
    if (!targetCard) {
      throw new Error(`No card found at face-up index ${faceUpIndex}`);
    }

    if (cardsDrawn === 1 && targetCard.color === 'locomotive') {
      throw new Error('Cannot take a face-up Locomotive as your second card.');
    }

    drawnCard = targetCard;

    const replacementCard = popFromDeck();
    if (replacementCard) {
      faceUp[faceUpIndex] = replacementCard;
    } else {
      faceUp.splice(faceUpIndex, 1);
    }
  } else {
    drawnCard = popFromDeck();
    if (!drawnCard) {
      throw new Error('No train cards remaining in deck or discard pile.');
    }
  }

  const updatedPlayer: Player = {
    ...player,
    trainCards: [...player.trainCards, drawnCard],
  };

  const newCardsDrawn = cardsDrawn + 1;
  const isFaceUpLocomotive = source === 'faceUp' && drawnCard.color === 'locomotive';

  const updatedGame: Game = {
    ...game,
    players: {
      ...game.players,
      [playerId]: updatedPlayer,
    },
    trainCardDeck: deck,
    faceUpTrainCards: faceUp,
    trainCardDiscardPile: discard,
    cardsDrawnThisTurn: newCardsDrawn,
    updatedAt: Date.now(),
  };

  const refreshedGame = checkAndRefreshFaceUpLocomotives(updatedGame);

  const totalRemainingInDraws =
    refreshedGame.trainCardDeck.length +
    refreshedGame.trainCardDiscardPile.length +
    refreshedGame.faceUpTrainCards.length;

  if (isFaceUpLocomotive || newCardsDrawn >= 2 || totalRemainingInDraws === 0) {
    const gameWithResetDrawCount = {
      ...refreshedGame,
      cardsDrawnThisTurn: 0,
    };
    return advanceTurn(gameWithResetDrawCount);
  }

  return refreshedGame;
}

export function drawTrainCards(game: Game, playerId: string, count: number = 2): Game {
  let updatedGame = game;
  for (let i = 0; i < count; i++) {
    const cardsDrawnSoFar = updatedGame.cardsDrawnThisTurn || 0;
    if (cardsDrawnSoFar >= 2) break;
    if (updatedGame.currentPlayerId !== null && updatedGame.currentPlayerId !== playerId) break;

    try {
      updatedGame = drawSingleTrainCard(updatedGame, playerId, 'deck');
    } catch {
      break;
    }
  }
  return updatedGame;
}

export interface DrawDestinationTicketsResult {
  game: Game;
  drawnTickets: DestinationTicket[];
}

export function drawDestinationTickets(
  game: Game,
  playerId: string,
  count: number = 3
): DrawDestinationTicketsResult {
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  const deck = [...game.destinationTicketDeck];
  const drawnTickets: DestinationTicket[] = [];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      break;
    }
    const ticket = deck.pop();
    if (ticket) {
      drawnTickets.push(ticket);
    }
  }

  const updatedGame: Game = {
    ...game,
    destinationTicketDeck: deck,
    updatedAt: Date.now(),
  };

  return {
    game: updatedGame,
    drawnTickets,
  };
}

export function selectDestinationTickets(
  game: Game,
  playerId: string,
  keptTickets: DestinationTicket[],
  unselectedTickets: DestinationTicket[]
): Game {
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  const updatedPlayer: Player = {
    ...player,
    destinationTickets: [...player.destinationTickets, ...keptTickets],
    pendingDestinationTickets: [],
  };

  delete updatedPlayer.pendingTicketsMinKeep;
  delete updatedPlayer.pendingTicketsFromTurn;

  // Return unselected tickets to the bottom of the destination ticket deck
  const updatedDeck = [...unselectedTickets, ...game.destinationTicketDeck];

  return {
    ...game,
    players: {
      ...game.players,
      [playerId]: updatedPlayer,
    },
    destinationTicketDeck: updatedDeck,
    updatedAt: Date.now(),
  };
}

export function confirmDestinationTicketSelection(
  game: Game,
  playerId: string,
  keptTicketIds: string[],
  isTurnAction: boolean = false
): Game {
  if (game.phase === 'finished' || game.status === 'completed') {
    throw new Error('Cannot select destination tickets: Game is finished.');
  }

  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  const pending = player.pendingDestinationTickets ?? [];
  const minKeep = player.pendingTicketsMinKeep ?? 1;
  const requiredKeep = Math.min(minKeep, pending.length);

  if (pending.length > 0 && keptTicketIds.length < requiredKeep) {
    throw new Error(`Must keep at least ${requiredKeep} destination ticket(s).`);
  }

  let keptTickets: DestinationTicket[] = [];
  let unselectedTickets: DestinationTicket[] = [];

  if (pending.length > 0) {
    keptTickets = pending.filter((t) => keptTicketIds.includes(t.id));
    unselectedTickets = pending.filter((t) => !keptTicketIds.includes(t.id));

    if (keptTickets.length < requiredKeep) {
      throw new Error(`Must keep at least ${requiredKeep} destination ticket(s).`);
    }
  }

  const wasFromTurn = player.pendingTicketsFromTurn ?? false;

  const updatedGame = selectDestinationTickets(game, playerId, keptTickets, unselectedTickets);

  // Advance turn if ticket selection was performed as an active turn action or drawn from a turn action
  if ((isTurnAction || wasFromTurn) && game.phase === 'playing' && game.currentPlayerId === playerId) {
    return advanceTurn(updatedGame);
  }

  return updatedGame;
}

export function areCitiesConnected(
  cityA: string,
  cityB: string,
  claimedRouteIds: string[],
  routes: Record<string, Route>
): boolean {
  if (cityA === cityB) {
    return true;
  }

  // Build adjacency list for claimed routes
  const adj = new Map<string, Set<string>>();

  for (const routeId of claimedRouteIds) {
    const route = routes[routeId];
    if (!route) continue;

    if (!adj.has(route.cityA)) adj.set(route.cityA, new Set());
    if (!adj.has(route.cityB)) adj.set(route.cityB, new Set());

    adj.get(route.cityA)!.add(route.cityB);
    adj.get(route.cityB)!.add(route.cityA);
  }

  if (!adj.has(cityA) || !adj.has(cityB)) {
    return false;
  }

  // BFS traversal
  const queue: string[] = [cityA];
  const visited = new Set<string>([cityA]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === cityB) {
      return true;
    }

    const neighbors = adj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return false;
}

export function isTicketCompleted(
  ticket: DestinationTicket,
  claimedRouteIds: string[],
  routes: Record<string, Route>
): boolean {
  return areCitiesConnected(ticket.cityA, ticket.cityB, claimedRouteIds, routes);
}

export function calculateDestinationTicketScore(
  tickets: DestinationTicket[],
  claimedRouteIds: string[],
  routes: Record<string, Route>
): number {
  let ticketScore = 0;
  for (const ticket of tickets) {
    if (isTicketCompleted(ticket, claimedRouteIds, routes)) {
      ticketScore += ticket.points;
    } else {
      ticketScore -= ticket.points;
    }
  }
  return ticketScore;
}

export function calculatePlayerScore(
  player: Player,
  routes: Record<string, Route>,
  includeDestinationTickets: boolean = true
): number {
  let score = 0;
  for (const routeId of player.claimedRoutes) {
    const route = routes[routeId];
    if (route) {
      score += getPointsForRouteLength(route.length);
    }
  }

  if (includeDestinationTickets) {
    score += calculateDestinationTicketScore(
      player.destinationTickets,
      player.claimedRoutes,
      routes
    );
  }

  return score;
}

export function calculateFinalPlayerScore(
  player: Player,
  routes: Record<string, Route>
): number {
  return calculatePlayerScore(player, routes, true);
}

export function executeDrawTrainCardsTurn(
  game: Game,
  playerId: string,
  count: number = 2
): Game {
  if (game.currentPlayerId !== null && game.currentPlayerId !== playerId) {
    throw new Error(`Cannot draw train cards: Not player ${playerId}'s turn.`);
  }

  return drawTrainCards(game, playerId, count);
}

export function executeClaimRouteTurn(
  game: Game,
  playerId: string,
  routeId: string,
  cardsToUse: TrainCard[]
): Game {
  // claimRoute already validates turn and advances turn
  return claimRoute(game, playerId, routeId, cardsToUse);
}

export function executeDrawDestinationTicketsTurn(
  game: Game,
  playerId: string,
  count: number = 3,
  keptTicketIds?: string[]
): Game {
  if (game.phase === 'finished' || game.status === 'completed') {
    throw new Error('Cannot draw destination tickets: Game is finished.');
  }

  if (game.currentPlayerId !== playerId) {
    throw new Error(`Cannot draw destination tickets: Not player ${playerId}'s turn.`);
  }

  const existingPlayer = game.players[playerId];
  if (existingPlayer?.pendingDestinationTickets && existingPlayer.pendingDestinationTickets.length > 0) {
    throw new Error('Must complete pending destination ticket selection first.');
  }

  if (game.cardsDrawnThisTurn && game.cardsDrawnThisTurn > 0) {
    throw new Error('Cannot draw destination tickets after drawing train cards this turn.');
  }

  if (game.destinationTicketDeck.length === 0) {
    throw new Error('No destination tickets remaining in deck.');
  }

  const { game: updatedGame, drawnTickets } = drawDestinationTickets(game, playerId, count);
  const player = updatedGame.players[playerId];

  if (keptTicketIds !== undefined) {
    const tempGame = {
      ...updatedGame,
      players: {
        ...updatedGame.players,
        [playerId]: {
          ...player,
          pendingDestinationTickets: drawnTickets,
          pendingTicketsMinKeep: Math.min(1, drawnTickets.length),
          pendingTicketsFromTurn: true,
        },
      },
    };
    return confirmDestinationTicketSelection(tempGame, playerId, keptTicketIds, true);
  } else {
    const updatedPlayer: Player = {
      ...player,
      pendingDestinationTickets: [...(player.pendingDestinationTickets || []), ...drawnTickets],
      pendingTicketsMinKeep: Math.min(1, drawnTickets.length),
      pendingTicketsFromTurn: true,
    };

    return {
      ...updatedGame,
      players: {
        ...updatedGame.players,
        [playerId]: updatedPlayer,
      },
      updatedAt: Date.now(),
    };
  }
}

export function executeTurnAction(game: Game, playerId: string, action: PlayerAction): Game {
  if (game.phase === 'finished' || game.status === 'completed') {
    throw new Error('Cannot perform action: Game is finished.');
  }

  switch (action.type) {
    case 'DRAW_TRAIN_CARD':
      return drawSingleTrainCard(game, playerId, action.source, action.index);
    case 'DRAW_TRAIN_CARDS': {
      if (action.source) {
        return drawSingleTrainCard(game, playerId, action.source, action.index);
      }
      return executeDrawTrainCardsTurn(game, playerId, action.count ?? 2);
    }
    case 'CLAIM_ROUTE':
      return executeClaimRouteTurn(game, playerId, action.routeId, action.cardsToUse);
    case 'DRAW_DESTINATION_TICKETS':
      return executeDrawDestinationTicketsTurn(
        game,
        playerId,
        action.count ?? 3,
        action.keptTicketIds
      );
    case 'SELECT_DESTINATION_TICKETS':
      return confirmDestinationTicketSelection(game, playerId, action.keptTicketIds, true);
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${JSON.stringify(_exhaustiveCheck)}`);
    }
  }
}
