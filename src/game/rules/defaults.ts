import type { BoardState, City, DestinationTicket, Route, TrainCard, TrainColor } from '../model/types';

export const INITIAL_TRAINS_PER_PLAYER = 45;

export const DEFAULT_CITIES: Record<string, City> = {
  city_a: { id: 'city_a', name: 'Alpha City' },
  city_b: { id: 'city_b', name: 'Beta Town' },
  city_c: { id: 'city_c', name: 'Gamma Metro' },
  city_d: { id: 'city_d', name: 'Delta Junction' },
  city_e: { id: 'city_e', name: 'Epsilon Port' },
};

export const DEFAULT_ROUTES: Record<string, Route> = {
  route_ab_red: {
    routeId: 'route_ab_red',
    cityA: 'city_a',
    cityB: 'city_b',
    length: 2,
    colorRequirement: 'red',
    ownerPlayerId: null,
    parallelRouteGroupId: 'group_ab',
  },
  route_ab_blue: {
    routeId: 'route_ab_blue',
    cityA: 'city_a',
    cityB: 'city_b',
    length: 2,
    colorRequirement: 'blue',
    ownerPlayerId: null,
    parallelRouteGroupId: 'group_ab',
  },
  route_bc_any: {
    routeId: 'route_bc_any',
    cityA: 'city_b',
    cityB: 'city_c',
    length: 3,
    colorRequirement: 'any',
    ownerPlayerId: null,
  },
  route_cd_green: {
    routeId: 'route_cd_green',
    cityA: 'city_c',
    cityB: 'city_d',
    length: 4,
    colorRequirement: 'green',
    ownerPlayerId: null,
  },
  route_de_yellow: {
    routeId: 'route_de_yellow',
    cityA: 'city_d',
    cityB: 'city_e',
    length: 6,
    colorRequirement: 'yellow',
    ownerPlayerId: null,
  },
};

export function createInitialBoard(): BoardState {
  return {
    cities: { ...DEFAULT_CITIES },
    routes: JSON.parse(JSON.stringify(DEFAULT_ROUTES)),
  };
}

export function createSampleTrainDeck(): TrainCard[] {
  const colors: TrainColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
  const deck: TrainCard[] = [];
  let cardId = 1;

  for (const color of colors) {
    for (let i = 0; i < 12; i++) {
      deck.push({ id: `card_${cardId++}`, color });
    }
  }

  // Locomotives / Wild cards
  for (let i = 0; i < 14; i++) {
    deck.push({ id: `card_${cardId++}`, color: 'locomotive' });
  }

  return deck;
}

export function createSampleDestinationDeck(): DestinationTicket[] {
  return [
    { id: 'ticket_1', cityA: 'city_a', cityB: 'city_c', points: 5 },
    { id: 'ticket_2', cityA: 'city_b', cityB: 'city_d', points: 8 },
    { id: 'ticket_3', cityA: 'city_a', cityB: 'city_e', points: 13 },
    { id: 'ticket_4', cityA: 'city_c', cityB: 'city_e', points: 7 },
  ];
}

export const ROUTE_LENGTH_POINTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
};

export function getPointsForRouteLength(length: number): number {
  return ROUTE_LENGTH_POINTS[length] ?? length * 2;
}
