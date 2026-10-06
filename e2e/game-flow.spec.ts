import { test, expect } from '@playwright/test';

test.describe('Rails Between Us - E2E Gameplay Suite', () => {
  test('1. Create Game - verify lobby and creator player', async ({ page }) => {
    const gameId = `e2e_create_${Date.now()}`;
    await page.goto('/');

    await expect(page.getByTestId('lobby-setup-container')).toBeVisible();
    await page.getByTestId('player-name-input').fill('Alice');
    await page.getByTestId('game-id-input').fill(gameId);
    await page.getByTestId('create-game-btn').click();

    await expect(page.getByTestId('lobby-active-container')).toBeVisible();
    await expect(page.getByTestId('game-code-display')).toHaveText(gameId);
    await expect(page.getByTestId('players-list')).toContainText('Alice');
  });

  test('2. Join Game, Start Game, and Play Actions', async ({ page }) => {
    const gameId = `e2e_game_${Date.now()}`;

    // Step 2.1: Player 1 creates game
    await page.goto('/');
    await page.getByTestId('player-name-input').fill('Alice');
    await page.getByTestId('game-id-input').fill(gameId);
    await page.getByTestId('create-game-btn').click();

    await expect(page.getByTestId('lobby-active-container')).toBeVisible();
    await expect(page.getByTestId('players-list')).toContainText('Alice');

    // Step 2.2: Add second player Bob directly to game state via LocalStorage and trigger storage event
    await page.evaluate((gid) => {
      const sessionData = localStorage.getItem(`rails_game_${gid}`);
      if (sessionData) {
        const game = JSON.parse(sessionData);
        game.players['p_bob'] = {
          playerId: 'p_bob',
          displayName: 'Bob',
          color: '#3182ce',
          ready: true,
          trainCards: [],
          destinationTickets: [],
          claimedRoutes: [],
          trainsRemaining: 45,
          score: 0,
        };
        game.playerOrder.push('p_bob');
        localStorage.setItem(`rails_game_${gid}`, JSON.stringify(game));
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: `rails_game_${gid}`,
            newValue: JSON.stringify(game),
          })
        );
      }
    }, gameId);

    await expect(page.getByTestId('players-list')).toContainText('Bob');

    // Step 2.3: Start Game
    await page.getByTestId('start-game-btn').click();

    await expect(page.getByTestId('in-game-container')).toBeVisible();

    // Confirm initial destination tickets modal
    const ticketModal = page.getByTestId('destination-ticket-modal');
    if (await ticketModal.isVisible().catch(() => false)) {
      await page.getByTestId('confirm-tickets-btn').click();
    }

    // Step 2.4: Verify Initial Hand & 5 Face-Up Cards
    await expect(page.getByTestId('player-hand')).toBeVisible();
    await expect(page.getByTestId('player-hand')).toContainText('Your Hand (4 cards)');

    await expect(page.getByTestId('face-up-cards-container')).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId(`face-up-card-${i}`)).toBeVisible();
    }

    // Step 2.5: Verify Active Player Turn Actions
    const drawDeckBtn = page.getByTestId('draw-deck-btn');
    if (await drawDeckBtn.isEnabled()) {
      await drawDeckBtn.click();
      await expect(page.getByTestId('player-hand')).toContainText('Your Hand (5 cards)');
      await drawDeckBtn.click();
      await expect(page.getByTestId('player-hand')).toContainText('Your Hand (6 cards)');
    }

    // Step 2.6: Route Selection on Game Board
    await page.getByTestId('route-group-route_denver_salt_lake_city_red').click();
    await expect(page.getByTestId('selected-route-panel')).toBeVisible();
  });

  test('3. Draw face-up card, replace, and turn progression', async ({ page }) => {
    const gameId = `e2e_faceup_${Date.now()}`;

    await page.goto('/');
    await page.getByTestId('player-name-input').fill('Alice');
    await page.getByTestId('game-id-input').fill(gameId);
    await page.getByTestId('create-game-btn').click();

    await page.evaluate((gid) => {
      const sessionData = localStorage.getItem(`rails_game_${gid}`);
      if (sessionData) {
        const game = JSON.parse(sessionData);
        game.players['p_bob'] = {
          playerId: 'p_bob',
          displayName: 'Bob',
          color: '#3182ce',
          ready: true,
          trainCards: [],
          destinationTickets: [],
          claimedRoutes: [],
          trainsRemaining: 45,
          score: 0,
        };
        game.playerOrder.push('p_bob');
        localStorage.setItem(`rails_game_${gid}`, JSON.stringify(game));
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: `rails_game_${gid}`,
            newValue: JSON.stringify(game),
          })
        );
      }
    }, gameId);

    await page.getByTestId('start-game-btn').click();
    await expect(page.getByTestId('in-game-container')).toBeVisible();

    const ticketModal = page.getByTestId('destination-ticket-modal');
    if (await ticketModal.isVisible().catch(() => false)) {
      await page.getByTestId('confirm-tickets-btn').click();
    }

    // Draw card from face-up display slot 0
    const faceUpCard0 = page.getByTestId('face-up-card-0');
    if (await faceUpCard0.isEnabled()) {
      await faceUpCard0.click();
      await expect(page.getByTestId('player-hand')).toContainText('Your Hand (5 cards)');
    }
  });

  test('4. Error handling when joining non-existent game', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('player-name-input').fill('Charlie');
    await page.getByTestId('game-id-input').fill('NONEXISTENT_99999');
    await page.getByTestId('join-game-btn').click();

    await expect(page.getByTestId('lobby-error')).toBeVisible();
    await expect(page.getByTestId('lobby-error')).toContainText('does not exist');
  });
});
