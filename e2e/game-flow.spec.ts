import { test, expect } from '@playwright/test';

test.describe('Rails Between Us - E2E Multiplayer Gameplay Suite', () => {
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

      // Confirm initial ticket selection on page 1
      const modal1 = page1.getByTestId('destination-ticket-modal');
      await expect(modal1).toBeVisible();
      await page1.getByTestId('confirm-tickets-btn').click();
      await expect(modal1).toBeHidden();

      // Confirm initial ticket selection on page 2
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

  test('4. Destination ticket flow - draw during gameplay, confirm selection, and verify turn advancement', async ({ context }) => {
    const gameId = `e2e_tickets_${Date.now()}`;

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Client 1 (Alice) creates game
      await page1.goto('/');
      await page1.getByTestId('player-name-input').fill('Alice');
      await page1.getByTestId('game-id-input').fill(gameId);
      await page1.getByTestId('color-swatch-#e53e3e').click();
      await page1.getByTestId('create-game-btn').click();

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

      // Verify both clients in lobby
      await expect(page1.getByTestId('players-list')).toContainText('Alice');
      await expect(page1.getByTestId('players-list')).toContainText('Bob');

      // Start game
      await page1.getByTestId('start-game-btn').click();
      await expect(page1.getByTestId('in-game-container')).toBeVisible();
      await expect(page2.getByTestId('in-game-container')).toBeVisible();

      // Both players confirm initial 3 tickets
      await page1.getByTestId('confirm-tickets-btn').click();
      await page2.getByTestId('confirm-tickets-btn').click();

      await expect(page1.getByTestId('player-tickets-section')).toContainText('Your Destination Tickets (3)');
      await expect(page2.getByTestId('player-tickets-section')).toContainText('Your Destination Tickets (3)');

      // Determine active player
      const activePlayerName = (await page1.getByTestId('current-player-name').textContent())?.trim();
      const activePage = activePlayerName === 'Alice' ? page1 : page2;

      // Active player draws destination tickets during gameplay
      await activePage.getByTestId('draw-tickets-btn').click();

      // Modal appears offering 3 new tickets
      const ticketModal = activePage.getByTestId('destination-ticket-modal');
      await expect(ticketModal).toBeVisible();

      // Active player keeps all 3 drawn tickets
      await activePage.getByTestId('confirm-tickets-btn').click();
      await expect(ticketModal).toBeHidden();

      // Active player now has 6 kept tickets in hand
      await expect(activePage.getByTestId('player-tickets-section')).toContainText('Your Destination Tickets (6)');

      // Turn advances to the next player
      const nextPlayerName = activePlayerName === 'Alice' ? 'Bob' : 'Alice';
      await expect(page1.getByTestId('current-player-name')).toHaveText(nextPlayerName);
      await expect(page2.getByTestId('current-player-name')).toHaveText(nextPlayerName);
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('5. Final Round & Finished Game Scoreboard - Trigger final round, complete final turns, and verify final scores on both clients', async ({ context }) => {
    const gameId = `e2e_final_round_${Date.now()}`;

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Client 1 (Alice) creates game
      await page1.goto('/');
      await page1.getByTestId('player-name-input').fill('Alice');
      await page1.getByTestId('game-id-input').fill(gameId);
      await page1.getByTestId('color-swatch-#e53e3e').click();
      await page1.getByTestId('create-game-btn').click();

      // Client 2 (Bob) joins game
      await page2.goto('/');
      if (await page2.getByTestId('leave-lobby-btn').isVisible({ timeout: 2000 }).catch(() => false)) {
        await page2.getByTestId('leave-lobby-btn').click();
      }
      await expect(page2.getByTestId('lobby-setup-container')).toBeVisible();
      await page2.getByTestId('player-name-input').fill('Bob');
      await page2.getByTestId('game-id-input').fill(gameId);
      await page2.getByTestId('color-swatch-#3182ce').click();
      await page2.getByTestId('join-game-btn').click();

      // Start game
      await page1.getByTestId('start-game-btn').click();
      await expect(page1.getByTestId('in-game-container')).toBeVisible();
      await expect(page2.getByTestId('in-game-container')).toBeVisible();

      // Both players confirm initial tickets
      await page1.getByTestId('confirm-tickets-btn').click();
      await page2.getByTestId('confirm-tickets-btn').click();

      // Determine starting active player
      const activePlayerName = (await page1.getByTestId('current-player-name').textContent())?.trim();
      const p1IsActive = activePlayerName === 'Alice';
      const activePage = p1IsActive ? page1 : page2;
      const inactivePage = p1IsActive ? page2 : page1;

      // Simulate active player having 2 remaining trains in game state to trigger final round
      await activePage.evaluate(async (gid) => {
        const key = `rails_game_${gid}`;
        const data = localStorage.getItem(key);
        if (data) {
          const game = JSON.parse(data);
          const activePid = game.currentPlayerId;
          if (activePid && game.players[activePid]) {
            game.players[activePid].trainsRemaining = 2;
            const forceUpdate = (window as unknown as Record<string, (g: unknown) => Promise<unknown>>).__FORCE_UPDATE_GAME__;
            if (forceUpdate) {
              await forceUpdate(game);
            } else {
              localStorage.setItem(key, JSON.stringify(game));
              window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(game) }));
            }
          }
        }
      }, gameId);

      // Active player takes their turn (draws 2 cards), which triggers final round
      await activePage.getByTestId('draw-deck-btn').click();
      await activePage.getByTestId('draw-deck-btn').click();

      // Verify final round banner is displayed on BOTH clients
      await expect(page1.getByTestId('final-round-banner')).toBeVisible();
      await expect(page2.getByTestId('final-round-banner')).toBeVisible();

      // Inactive player takes their final turn
      await inactivePage.getByTestId('draw-deck-btn').click();
      await inactivePage.getByTestId('draw-deck-btn').click();

      // Active player takes their final turn to complete the final round
      await activePage.getByTestId('draw-deck-btn').click();
      await activePage.getByTestId('draw-deck-btn').click();

      // Game is now finished. Verify finished scoreboard appears on BOTH clients
      await expect(page1.getByTestId('finished-game-scoreboard')).toBeVisible();
      await expect(page2.getByTestId('finished-game-scoreboard')).toBeVisible();

      // Verify both clients agree on winner announcement and final score values
      await expect(page1.getByTestId('scoreboard-title')).toContainText('Game Over - Final Results');
      await expect(page2.getByTestId('scoreboard-title')).toContainText('Game Over - Final Results');

      const page1Score = await page1.locator('[data-testid^="final-score-"]').first().textContent();
      const page2Score = await page2.locator('[data-testid^="final-score-"]').first().textContent();

      expect(page1Score).toBeTruthy();
      expect(page1Score).toBe(page2Score);
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('6. Destination ticket deck exhaustion flow - offer remaining tickets and return unselected to deck', async ({ context }) => {
    const gameId = `e2e_ticket_exhaust_${Date.now()}`;

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await page1.goto('/');
      await page1.getByTestId('player-name-input').fill('Alice');
      await page1.getByTestId('game-id-input').fill(gameId);
      await page1.getByTestId('create-game-btn').click();

      await page2.goto('/');
      await expect(page2.getByTestId('lobby-active-container')).toBeVisible();
      await page2.getByTestId('leave-lobby-btn').click();

      await expect(page2.getByTestId('lobby-setup-container')).toBeVisible();
      await page2.getByTestId('player-name-input').fill('Bob');
      await page2.getByTestId('game-id-input').fill(gameId);
      await page2.getByTestId('color-swatch-#3182ce').click();
      await page2.getByTestId('join-game-btn').click();

      await expect(page1.getByTestId('players-list')).toContainText('Alice');
      await expect(page1.getByTestId('players-list')).toContainText('Bob');

      await page1.getByTestId('start-game-btn').click();
      await expect(page1.getByTestId('in-game-container')).toBeVisible();
      await expect(page2.getByTestId('in-game-container')).toBeVisible();

      await page1.getByTestId('confirm-tickets-btn').click();
      await page2.getByTestId('confirm-tickets-btn').click();

      const activePlayerName = (await page1.getByTestId('current-player-name').textContent())?.trim();
      const activePage = activePlayerName === 'Alice' ? page1 : page2;

      // Manipulate game state to set destinationTicketDeck length to exactly 2 tickets
      await activePage.evaluate(async (gid) => {
        const key = `rails_game_${gid}`;
        const data = localStorage.getItem(key);
        if (data) {
          const game = JSON.parse(data);
          game.destinationTicketDeck = game.destinationTicketDeck.slice(0, 2);
          const forceUpdate = (window as unknown as Record<string, (g: unknown) => Promise<unknown>>).__FORCE_UPDATE_GAME__;
          if (forceUpdate) {
            await forceUpdate(game);
          } else {
            localStorage.setItem(key, JSON.stringify(game));
            window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(game) }));
          }
        }
      }, gameId);

      // Active player draws destination tickets when only 2 remain in deck
      await activePage.getByTestId('draw-tickets-btn').click();

      const modal = activePage.getByTestId('destination-ticket-modal');
      await expect(modal).toBeVisible();

      // Checkbox count in modal should be 2
      const checkboxes = modal.locator('input[type="checkbox"]');
      await expect(checkboxes).toHaveCount(2);

      // Uncheck second ticket to keep only 1 ticket
      await checkboxes.nth(1).uncheck();
      await activePage.getByTestId('confirm-tickets-btn').click();
      await expect(modal).toBeHidden();

      // Turn advances cleanly
      const nextPlayerName = activePlayerName === 'Alice' ? 'Bob' : 'Alice';
      await expect(page1.getByTestId('current-player-name')).toHaveText(nextPlayerName);

      // Verify the returned 1 ticket went back to destinationTicketDeck
      const deckCountText = await page1.locator('div', { hasText: 'Ticket Deck:' }).first().textContent();
      expect(deckCountText).toContain('1 tickets');
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('7. Final Score Tie-Breaker - Completed tickets count breaks score tie', async ({ page }) => {
    const gameId = `e2e_tie_tickets_${Date.now()}`;

    await page.goto('/');
    await page.getByTestId('player-name-input').fill('Alice');
    await page.getByTestId('game-id-input').fill(gameId);
    await page.getByTestId('create-game-btn').click();

    // Create a finished game state in localStorage where Alice and Bob tie on total score (50 pts),
    // but Bob completed 2 tickets vs Alice 1 ticket.
    await page.evaluate(async (gid) => {
      const key = `rails_game_${gid}`;
      const existing = localStorage.getItem(key);
      const baseGame = existing ? JSON.parse(existing) : {};

      const finishedGame = {
        ...baseGame,
        gameId: gid,
        phase: 'finished',
        status: 'completed',
        currentPlayerId: null,
        turnNumber: 10,
        playerOrder: ['p1', 'p2'],
        players: {
          p1: {
            playerId: 'p1',
            displayName: 'Alice',
            color: '#e53e3e',
            ready: true,
            trainCards: [],
            destinationTickets: [{ id: 't1', cityA: 'boston', cityB: 'new_york', points: 10 }],
            claimedRoutes: [],
            trainsRemaining: 0,
            score: 50,
            scoreBreakdown: {
              routePoints: 40,
              destinationTicketPoints: 10,
              completedTicketsCount: 1,
              longestPathLength: 10,
              longestPathBonus: 0,
              finalScore: 50,
            },
          },
          p2: {
            playerId: 'p2',
            displayName: 'Bob',
            color: '#3182ce',
            ready: true,
            trainCards: [],
            destinationTickets: [
              { id: 't2', cityA: 'chicago', cityB: 'st_louis', points: 10 },
              { id: 't3', cityA: 'denver', cityB: 'helena', points: 10 },
            ],
            claimedRoutes: [],
            trainsRemaining: 0,
            score: 50,
            scoreBreakdown: {
              routePoints: 30,
              destinationTicketPoints: 20,
              completedTicketsCount: 2,
              longestPathLength: 8,
              longestPathBonus: 0,
              finalScore: 50,
            },
          },
        },
        boardState: baseGame.boardState || { cities: {}, routes: {} },
        trainCardDeck: [],
        faceUpTrainCards: [],
        trainCardDiscardPile: [],
        destinationTicketDeck: [],
        destinationTicketDiscardPile: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const forceUpdate = (window as unknown as Record<string, (g: unknown) => Promise<unknown>>).__FORCE_UPDATE_GAME__;
      if (forceUpdate) {
        await forceUpdate(finishedGame);
      } else {
        localStorage.setItem(key, JSON.stringify(finishedGame));
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(finishedGame) }));
      }
    }, gameId);

    await expect(page.getByTestId('finished-game-scoreboard')).toBeVisible();
    await expect(page.getByTestId('winner-announcement')).toContainText('Bob wins with 50 points!');

    // First row in table should be Bob (#1 rank)
    const firstRow = page.locator('tr[data-testid^="player-score-row-"]').first();
    await expect(firstRow).toContainText('Bob');
  });

  test('8. Final Score Tie-Breaker - Longest continuous path breaks complete tie', async ({ page }) => {
    const gameId = `e2e_tie_longest_${Date.now()}`;

    await page.goto('/');
    await page.getByTestId('player-name-input').fill('Alice');
    await page.getByTestId('game-id-input').fill(gameId);
    await page.getByTestId('create-game-btn').click();

    // Alice and Bob have equal total score (60) AND equal completed tickets (2),
    // but Alice has longest path length 15 vs Bob 12. Alice should win!
    await page.evaluate(async (gid) => {
      const key = `rails_game_${gid}`;
      const existing = localStorage.getItem(key);
      const baseGame = existing ? JSON.parse(existing) : {};

      const finishedGame = {
        ...baseGame,
        gameId: gid,
        phase: 'finished',
        status: 'completed',
        currentPlayerId: null,
        turnNumber: 12,
        playerOrder: ['p1', 'p2'],
        players: {
          p1: {
            playerId: 'p1',
            displayName: 'Alice',
            color: '#e53e3e',
            ready: true,
            trainCards: [],
            destinationTickets: [],
            claimedRoutes: [],
            trainsRemaining: 0,
            score: 60,
            scoreBreakdown: {
              routePoints: 50,
              destinationTicketPoints: 10,
              completedTicketsCount: 2,
              longestPathLength: 15,
              longestPathBonus: 0,
              finalScore: 60,
            },
          },
          p2: {
            playerId: 'p2',
            displayName: 'Bob',
            color: '#3182ce',
            ready: true,
            trainCards: [],
            destinationTickets: [],
            claimedRoutes: [],
            trainsRemaining: 0,
            score: 60,
            scoreBreakdown: {
              routePoints: 50,
              destinationTicketPoints: 10,
              completedTicketsCount: 2,
              longestPathLength: 12,
              longestPathBonus: 0,
              finalScore: 60,
            },
          },
        },
        boardState: baseGame.boardState || { cities: {}, routes: {} },
        trainCardDeck: [],
        faceUpTrainCards: [],
        trainCardDiscardPile: [],
        destinationTicketDeck: [],
        destinationTicketDiscardPile: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const forceUpdate = (window as unknown as Record<string, (g: unknown) => Promise<unknown>>).__FORCE_UPDATE_GAME__;
      if (forceUpdate) {
        await forceUpdate(finishedGame);
      } else {
        localStorage.setItem(key, JSON.stringify(finishedGame));
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(finishedGame) }));
      }
    }, gameId);

    await expect(page.getByTestId('finished-game-scoreboard')).toBeVisible();
    await expect(page.getByTestId('winner-announcement')).toContainText('Alice wins with 60 points!');

    const firstRow = page.locator('tr[data-testid^="player-score-row-"]').first();
    await expect(firstRow).toContainText('Alice');
  });
});
