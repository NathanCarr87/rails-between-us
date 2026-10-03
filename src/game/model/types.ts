export type GameStatus = 'waiting' | 'active' | 'completed';

export type TrainColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'black'
  | 'white';

export type CardColor = TrainColor | 'locomotive';

export interface TrainCard {
  id: string;
  color: CardColor;
}

export interface DestinationTicket {
  id: string;
  cityA: string;
  cityB: string;
  points: number;
}

export interface City {
  id: string;
  name: string;
}

export interface Route {
  routeId: string;
  cityA: string;
  cityB: string;
  length: number;
  colorRequirement: TrainColor | 'any';
  ownerPlayerId: string | null;
  parallelRouteGroupId?: string | null;
}

export interface Player {
  playerId: string;
  displayName: string;
  color: string;
  trainCards: TrainCard[];
  destinationTickets: DestinationTicket[];
  claimedRoutes: string[]; // routeIds
  trainsRemaining: number;
  score: number;
}

export interface BoardState {
  cities: Record<string, City>;
  routes: Record<string, Route>;
}

export interface Game {
  gameId: string;
  status: GameStatus;
  players: Record<string, Player>;
  playerOrder: string[];
  currentPlayerId: string | null;
  turnNumber: number;
  boardState: BoardState;
  trainCardDeck: TrainCard[];
  trainCardDiscardPile: TrainCard[];
  destinationTicketDeck: DestinationTicket[];
  destinationTicketDiscardPile: DestinationTicket[];
  createdAt: number;
  updatedAt: number;
}
