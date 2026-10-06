import { test, expect, Page } from '@playwright/test';

test.describe('Rails Between Us - E2E Multiplayer Gameplay Suite', () => {
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

  test('2. Multi-context Join, Start Game, and State Synchronization', async ({ browser }) => {
    const gameId = `e2e_multi_${Date.now()}`;

    // Create two separate browser contexts so LocalStorage session is isolated per player
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await test.step('Client 1 (Alice) creates game', async () => {
        await page1.goto('/');
        await expect(page1.getByTestId('lobby-setup-container')).toBeVisible();
        await page1.getByTestId('player-name-input').fill('Alice');
        await page1.getByTestId('game-id-input').fill(gameId);
        await page1.getByTestId('color-swatch-#e53e3e').click();
        await page1.getByTestId('create-game-btn').click();
        await expect(page1.getByTestId('lobby-active-container')).toBeVisible();
      });

      await test.step('Client 2 (Bob) joins game from second browser context', async () => {
        await page2.goto('/');
        await expect(page2.getByTestId('lobby-setup-container')).toBeVisible();
        await page2.getByTestId('player-name-input').fill('Bob');
        await page2.getByTestId('game-id-input').fill(gameId);
        await page2.getByTestId('color-swatch-#3182ce').click();
        await page2.getByTestId('join-game-btn').click();
        await expect(page2.getByTestId('lobby-active-container')).toBeVisible();
      });

      await test.step('Verify both clients see both players in lobby', async () => {
        await expect(page1.getByTestId('players-list')).toContainText('Alice');
        await expect(page1.getByTestId('players-list')).toContainText('Bob');
        await expect(page2.getByTestId('players-list')).toContainText('Alice');
        await expect(page2.getByTestId('players-list')).toContainText('Bob');
      });

      await test.step('Host (Alice) starts the game and both clients transition', async () => {
        await page1.getByTestId('start-game-btn').click();
        await expect(page1.getByTestId('in-game-container')).toBeVisible();
        await expect(page2.getByTestId('in-game-container')).toBeVisible();
      });

      await test.step('Confirm initial ticket selection on both pages', async () => {
        const modal1 = page1.getByTestId('destination-ticket-modal');
        await expect(modal1).toBeVisible();
        await page1.getByTestId('confirm-tickets-btn').click();
        await expect(modal1).toBeHidden();

        const modal2 = page2.getByTestId('destination-ticket-modal');
        await expect(modal2).toBeVisible();
        await page2.getByTestId('confirm-tickets-btn').click();
        await expect(modal2).toBeHidden();
      });

      await test.step('Verify initial hand and face-up card visibility', async () => {
        await expect(page1.getByTestId('player-hand')).toContainText('Your Hand (4 cards)');
        await expect(page2.getByTestId('player-hand')).toContainText('Your Hand (4 cards)');

        for (let i = 0; i < 5; i++) {
          await expect(page1.getByTestId(`face-up-card-${i}`)).toBeVisible();
          await expect(page2.getByTestId(`face-up-card-${i}`)).toBeVisible();
        }
      });

      let activePage: Page;
      let inactivePage: Page;
      let activePlayerName: string;

      await test.step('Identify active player turn and verify inactive restrictions', async () => {
        await expect(page1.getByTestId('current-player-name')).not.toBeEmpty();
        activePlayerName = ((await page1.getByTestId('current-player-name').textContent()) || '').trim();

        if (activePlayerName === 'Alice') {
          activePage = page1;
          inactivePage = page2;
        } else {
          activePage = page2;
          inactivePage = page1;
        }

        await expect(inactivePage.getByTestId('draw-deck-btn')).toBeDisabled();
      });

      await test.step('Active player draws 2 cards to advance turn', async () => {
        await activePage.getByTestId('draw-deck-btn').click();
        await expect(activePage.getByTestId('player-hand')).toContainText('Your Hand (5 cards)');

        await activePage.getByTestId('draw-deck-btn').click();
        await expect(activePage.getByTestId('player-hand')).toContainText('Your Hand (6 cards)');
      });

      await test.step('Verify turn advances to next player on both clients', async () => {
        const nextPlayerName = activePlayerName === 'Alice' ? 'Bob' : 'Alice';
        await expect(page1.getByTestId('current-player-name')).toHaveText(nextPlayerName);
        await expect(page2.getByTestId('current-player-name')).toHaveText(nextPlayerName);

        await expect(activePage.getByTestId('draw-deck-btn')).toBeDisabled();
        await expect(inactivePage.getByTestId('draw-deck-btn')).toBeEnabled();
      });

      await test.step('Test route selection on game board', async () => {
        await page1.getByTestId('route-group-route_denver_salt_lake_city_red').click();
        await expect(page1.getByTestId('selected-route-panel')).toBeVisible();
      });
    } finally {
      await context1.close().catch(() => {});
      await context2.close().catch(() => {});
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
