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
    trainCardDiscardPile: [],
    destinationTicketDeck: createSampleDestinationDeck(),
    destinationTicketDiscardPile: [],
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
      destinationTickets: p.destinationTickets ?? [],
    };
  }

  return {
    ...game,
    phase: 'playing',
    status: 'active',
    currentPlayerId,
    turnNumber,
    players: updatedPlayers,
    trainCardDeck: currentTrainDeck,
    destinationTicketDeck: currentTicketDeck,
    updatedAt: Date.now(),
  };
}

export function advanceTurn(game: Game): Game {
  if (game.status === 'completed' || game.playerOrder.length === 0) {
    return game;
  }

  let isFinalRound = game.isFinalRound ?? false;
  let finalRoundTriggeredBy = game.finalRoundTriggeredBy ?? null;

  // Check if current active player triggers final round (trainsRemaining <= 2)
  if (!isFinalRound && game.currentPlayerId) {
    const activePlayer = game.players[game.currentPlayerId];
    if (activePlayer && activePlayer.trainsRemaining <= 2) {
      isFinalRound = true;
      finalRoundTriggeredBy = game.currentPlayerId;
    }
  }

  const currentIndex = game.currentPlayerId ? game.playerOrder.indexOf(game.currentPlayerId) : -1;
  const nextIndex = (currentIndex + 1) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[nextIndex];

  // If final round was triggered and we have looped back to the player who triggered it
  if (isFinalRound && nextPlayerId === finalRoundTriggeredBy) {
    const finalPlayers: Record<string, Player> = {};
    for (const pid of game.playerOrder) {
      const p = game.players[pid];
      if (p) {
        finalPlayers[pid] = {
          ...p,
          score: calculateFinalPlayerScore(p, game.boardState.routes),
        };
      }
    }

    return {
      ...game,
      phase: 'finished',
      status: 'completed',
      currentPlayerId: null,
      isFinalRound: true,
      finalRoundTriggeredBy,
      players: finalPlayers,
      turnNumber: game.turnNumber + 1,
      updatedAt: Date.now(),
    };
  }

  return {
    ...game,
    currentPlayerId: nextPlayerId,
    turnNumber: game.turnNumber + 1,
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
  const player = game.players[playerId];
  if (!player) {
    return { allowed: false, reason: 'Player does not exist.' };
  }

  if (game.currentPlayerId !== playerId) {
    return { allowed: false, reason: 'Not this player turn.' };
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

export function drawTrainCards(game: Game, playerId: string, count: number = 2): Game {
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  let deck = [...game.trainCardDeck];
  let discard = [...game.trainCardDiscardPile];

  const drawn: TrainCard[] = [];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) {
        break; // No cards left to draw
      }
      // Reshuffle discard into deck
      deck = shuffleDeck(discard);
      discard = [];
    }
    const card = deck.pop();
    if (card) {
      drawn.push(card);
    }
  }

  const updatedPlayer: Player = {
    ...player,
    trainCards: [...player.trainCards, ...drawn],
  };

  return {
    ...game,
    players: {
      ...game.players,
      [playerId]: updatedPlayer,
    },
    trainCardDeck: deck,
    trainCardDiscardPile: discard,
    updatedAt: Date.now(),
  };
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
  const player = game.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} does not exist.`);
  }

  const pending = player.pendingDestinationTickets ?? [];
  let keptTickets: DestinationTicket[] = [];
  let unselectedTickets: DestinationTicket[] = [];

  if (pending.length > 0) {
    keptTickets = pending.filter((t) => keptTicketIds.includes(t.id));
    unselectedTickets = pending.filter((t) => !keptTicketIds.includes(t.id));
  }

  const updatedGame = selectDestinationTickets(game, playerId, keptTickets, unselectedTickets);

  // Advance turn only if this ticket selection was performed as an active turn action
  if (isTurnAction && game.phase === 'playing' && game.currentPlayerId === playerId) {
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
  if (game.currentPlayerId !== playerId) {
    throw new Error(`Cannot draw train cards: Not player ${playerId}'s turn.`);
  }

  const gameWithDrawnCards = drawTrainCards(game, playerId, count);
  return advanceTurn(gameWithDrawnCards);
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
  if (game.currentPlayerId !== playerId) {
    throw new Error(`Cannot draw destination tickets: Not player ${playerId}'s turn.`);
  }

  const { game: updatedGame, drawnTickets } = drawDestinationTickets(game, playerId, count);
  const player = updatedGame.players[playerId];

  if (keptTicketIds !== undefined) {
    const keptTickets = drawnTickets.filter((t) => keptTicketIds.includes(t.id));
    const unselectedTickets = drawnTickets.filter((t) => !keptTicketIds.includes(t.id));
    const gameWithSelected = selectDestinationTickets(
      updatedGame,
      playerId,
      keptTickets,
      unselectedTickets
    );
    return advanceTurn(gameWithSelected);
  } else {
    const updatedPlayer: Player = {
      ...player,
      pendingDestinationTickets: [...(player.pendingDestinationTickets || []), ...drawnTickets],
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
  switch (action.type) {
    case 'DRAW_TRAIN_CARDS':
      return executeDrawTrainCardsTurn(game, playerId, action.count ?? 2);
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
