import { test, expect } from '@playwright/test';

test.describe('Rails Between Us - E2E Gameplay Suite', () => {
  test('1. Create Game - verify lobby setup and creator player', async ({ page }) => {
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

  test('2. Multi-client Join, Start Game, and State Synchronization', async ({ context }) => {
    const gameId = `e2e_multi_${Date.now()}`;

    // Create two pages (clients) in the same browser context so local game storage is shared
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Client 1 (Alice) creates game
      await page1.goto('/');
      await expect(page1.getByTestId('lobby-setup-container')).toBeVisible();
      await page1.getByTestId('player-name-input').fill('Alice');
      await page1.getByTestId('game-id-input').fill(gameId);
      await page1.getByTestId('color-swatch-#e53e3e').click();
      await page1.getByTestId('create-game-btn').click();
      await expect(page1.getByTestId('lobby-active-container')).toBeVisible();
      await expect(page1.getByTestId('players-list')).toContainText('Alice');

      // Client 2 (Bob) opens app and leaves active auto-session to join as Bob
      await page2.goto('/');
      await expect(page2.getByTestId('lobby-active-container')).toBeVisible();
      await page2.getByTestId('leave-lobby-btn').click();

      // Client 2 enters setup and joins existing game
      await expect(page2.getByTestId('lobby-setup-container')).toBeVisible();
      await page2.getByTestId('player-name-input').fill('Bob');
      await page2.getByTestId('game-id-input').fill(gameId);
      await page2.getByTestId('color-swatch-#3182ce').click();
      await page2.getByTestId('join-game-btn').click();

      // Verify both clients see both players in the lobby
      await expect(page1.getByTestId('lobby-active-container')).toBeVisible();
      await expect(page2.getByTestId('lobby-active-container')).toBeVisible();
      await expect(page1.getByTestId('players-list')).toContainText('Alice');
      await expect(page1.getByTestId('players-list')).toContainText('Bob');
      await expect(page2.getByTestId('players-list')).toContainText('Alice');
      await expect(page2.getByTestId('players-list')).toContainText('Bob');

      // Host (Alice on Page 1) starts the game
      await page1.getByTestId('start-game-btn').click();

      // Both clients transition from lobby to game screen
      await expect(page1.getByTestId('in-game-container')).toBeVisible();
      await expect(page2.getByTestId('in-game-container')).toBeVisible();

      // Wait for pending destination ticket modals to appear and confirm selection
      const modal1 = page1.getByTestId('destination-ticket-modal');
      await expect(modal1).toBeVisible();
      await page1.getByTestId('confirm-tickets-btn').click();
      await expect(modal1).toBeHidden();

      const modal2 = page2.getByTestId('destination-ticket-modal');
      await expect(modal2).toBeVisible();
      await page2.getByTestId('confirm-tickets-btn').click();
      await expect(modal2).toBeHidden();

      // Verify initial cards (4 cards each)
      await expect(page1.getByTestId('player-hand')).toContainText('Your Hand (4 cards)');
      await expect(page2.getByTestId('player-hand')).toContainText('Your Hand (4 cards)');

      // Verify 5 face-up cards are displayed on both clients
      for (let i = 0; i < 5; i++) {
        await expect(page1.getByTestId(`face-up-card-${i}`)).toBeVisible();
        await expect(page2.getByTestId(`face-up-card-${i}`)).toBeVisible();
      }

      // Determine current turn
      await expect(page1.getByTestId('current-player-name')).toBeVisible();
      const activePlayerName = (await page1.getByTestId('current-player-name').textContent())?.trim();
      expect(activePlayerName).toBeTruthy();

      const activePage = activePlayerName === 'Alice' ? page1 : page2;
      const inactivePage = activePlayerName === 'Alice' ? page2 : page1;

      // Verify turn restriction: inactive player cannot draw from deck
      await expect(inactivePage.getByTestId('draw-deck-btn')).toBeDisabled();

      // Active player draws 2 cards from deck
      await activePage.getByTestId('draw-deck-btn').click();
      await expect(activePage.getByTestId('player-hand')).toContainText('Your Hand (5 cards)');
      await activePage.getByTestId('draw-deck-btn').click();
      await expect(activePage.getByTestId('player-hand')).toContainText('Your Hand (6 cards)');

      // Verify turn advances to next player on both clients
      const nextPlayerName = activePlayerName === 'Alice' ? 'Bob' : 'Alice';
      await expect(page1.getByTestId('current-player-name')).toHaveText(nextPlayerName);
      await expect(page2.getByTestId('current-player-name')).toHaveText(nextPlayerName);

      // Verify turn controls swapped: former active player disabled, new active player enabled
      await expect(activePage.getByTestId('draw-deck-btn')).toBeDisabled();
      await expect(inactivePage.getByTestId('draw-deck-btn')).toBeEnabled();

      // Test route selection on board
      await page1.getByTestId('route-group-route_denver_salt_lake_city_red').click();
      await expect(page1.getByTestId('selected-route-panel')).toBeVisible();
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('3. Error handling when joining non-existent game', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('player-name-input').fill('Charlie');
    await page.getByTestId('game-id-input').fill('NONEXISTENT_99999');
    await page.getByTestId('join-game-btn').click();

    await expect(page.getByTestId('lobby-error')).toBeVisible();
    await expect(page.getByTestId('lobby-error')).toContainText('does not exist');
  });
});
