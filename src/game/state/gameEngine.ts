import type { Game, Player, PlayerAction, Route, TrainCard } from '../model/types';
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

export function createGame(gameId: string = 'game_' + Date.now()): Game {
  const now = Date.now();
  return {
    gameId,
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
    createdAt: now,
    updatedAt: now,
  };
}

export function addPlayer(
  game: Game,
  playerInfo: { playerId: string; displayName: string; color: string }
): Game {
  if (game.playerOrder.length >= MAX_PLAYERS) {
    throw new Error(`Cannot add player: Maximum limit of ${MAX_PLAYERS} players reached.`);
  }

  if (game.players[playerInfo.playerId]) {
    throw new Error(`Player with ID ${playerInfo.playerId} already exists.`);
  }

  const newPlayer: Player = {
    playerId: playerInfo.playerId,
    displayName: playerInfo.displayName,
    color: playerInfo.color,
    trainCards: [],
    destinationTickets: [],
    claimedRoutes: [],
    trainsRemaining: INITIAL_TRAINS_PER_PLAYER,
    score: 0,
  };

  const updatedPlayerOrder = [...game.playerOrder, playerInfo.playerId];
  const newStatus = updatedPlayerOrder.length >= MIN_PLAYERS && game.status === 'waiting'
    ? 'active'
    : game.status;

  const currentPlayerId = game.currentPlayerId ?? (newStatus === 'active' ? updatedPlayerOrder[0] : null);
  const turnNumber = game.turnNumber === 0 && newStatus === 'active' ? 1 : game.turnNumber;

  return {
    ...game,
    status: newStatus,
    players: {
      ...game.players,
      [playerInfo.playerId]: newPlayer,
    },
    playerOrder: updatedPlayerOrder,
    currentPlayerId,
    turnNumber,
    updatedAt: Date.now(),
  };
}

export function advanceTurn(game: Game): Game {
  if (game.playerOrder.length === 0) {
    return game;
  }

  const currentIndex = game.currentPlayerId ? game.playerOrder.indexOf(game.currentPlayerId) : -1;
  const nextIndex = (currentIndex + 1) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[nextIndex];

  return {
    ...game,
    currentPlayerId: nextPlayerId,
    turnNumber: game.turnNumber + 1,
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

  // Update player tickets
  const updatedPlayer: Player = {
    ...player,
    destinationTickets: [...player.destinationTickets, ...keptTickets],
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

export function calculatePlayerScore(player: Player, routes: Record<string, Route>): number {
  let score = 0;
  for (const routeId of player.claimedRoutes) {
    const route = routes[routeId];
    if (route) {
      score += getPointsForRouteLength(route.length);
    }
  }
  return score;
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
  count: number = 3
): Game {
  if (game.currentPlayerId !== playerId) {
    throw new Error(`Cannot draw destination tickets: Not player ${playerId}'s turn.`);
  }

  const { game: updatedGame, drawnTickets } = drawDestinationTickets(game, playerId, count);
  const player = updatedGame.players[playerId];

  const updatedPlayer: Player = {
    ...player,
    destinationTickets: [...player.destinationTickets, ...drawnTickets],
  };

  const gameWithTickets: Game = {
    ...updatedGame,
    players: {
      ...updatedGame.players,
      [playerId]: updatedPlayer,
    },
    updatedAt: Date.now(),
  };

  return advanceTurn(gameWithTickets);
}

export function executeTurnAction(game: Game, playerId: string, action: PlayerAction): Game {
  switch (action.type) {
    case 'DRAW_TRAIN_CARDS':
      return executeDrawTrainCardsTurn(game, playerId, action.count ?? 2);
    case 'CLAIM_ROUTE':
      return executeClaimRouteTurn(game, playerId, action.routeId, action.cardsToUse);
    case 'DRAW_DESTINATION_TICKETS':
      return executeDrawDestinationTicketsTurn(game, playerId, action.count ?? 3);
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${JSON.stringify(_exhaustiveCheck)}`);
    }
  }
}
