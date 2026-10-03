import { describe, expect, it } from 'vitest';
import { DEFAULT_CITIES, DEFAULT_ROUTES } from '../../game/rules/defaults';
import { CITY_COORDINATES } from '../cityCoordinates';

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
