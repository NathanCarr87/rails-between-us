import React, { useState } from 'react';
import type { Game } from '../game/model/types';
import { PLAYER_COLORS } from '../game/state/gameEngine';
import { generateGameCode } from '../game/services/firebase';

interface LobbyProps {
  game: Game | null;
  localPlayerId: string;
  onCreateGame: (gameId: string, playerName: string, color: string) => void;
  onJoinGame: (gameId: string, playerName: string, color: string) => void;
  onSelectColor: (color: string) => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveGame?: () => void;
  errorMessage?: string | null;
}

export const Lobby: React.FC<LobbyProps> = ({
  game,
  localPlayerId,
  onCreateGame,
  onJoinGame,
  onSelectColor,
  onToggleReady,
  onStartGame,
  onLeaveGame,
  errorMessage,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[0]);
  const [copied, setCopied] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const id = gameIdInput.trim() || generateGameCode();
    const name = playerName.trim() || 'Player 1';
    onCreateGame(id, name, selectedColor);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameIdInput.trim()) {
      return;
    }
    const name = playerName.trim() || 'Player 2';
    onJoinGame(gameIdInput.trim(), name, selectedColor);
  };

  const handleCopyCode = () => {
    if (game?.gameId) {
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(game.gameId)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!game) {
    return (
      <div style={styles.container} data-testid="lobby-setup-container">
        <header style={styles.header}>
          <h1 style={styles.title}>Rails Between Us</h1>
          <p style={styles.subtitle}>Pregame Lobby & Player Identity</p>
        </header>

        {errorMessage && (
          <div style={styles.errorBox} data-testid="lobby-error">
            {errorMessage}
          </div>
        )}

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Enter Lobby</h2>

          <div style={styles.formGroup}>
            <label style={styles.label}>Player Name</label>
            <input
              type="text"
              placeholder="Your display name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={styles.input}
              data-testid="player-name-input"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Choose Color</label>
            <div style={styles.colorGrid}>
              {PLAYER_COLORS.map((c) => {
                const isSelected = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: c,
                      border: isSelected ? '3px solid #1a202c' : '2px solid #cbd5e0',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    }}
                    data-testid={`color-swatch-${c}`}
                  />
                );
              })}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Game Code / ID</label>
            <input
              type="text"
              placeholder="e.g. room123 (leave empty to generate)"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value)}
              style={styles.input}
              data-testid="game-id-input"
            />
          </div>

          <div style={styles.btnRow}>
            <button
              type="button"
              onClick={handleCreate}
              style={styles.btnPrimary}
              data-testid="create-game-btn"
            >
              Create New Game
            </button>
            <button
              type="button"
              onClick={handleJoin}
              style={styles.btnSuccess}
              data-testid="join-game-btn"
            >
              Join Existing Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  const playersList = Object.values(game.players);
  const localPlayer = game.players[localPlayerId];
  const takenColors = new Set(
    playersList
      .filter((p) => p.playerId !== localPlayerId)
      .map((p) => p.color.toLowerCase())
  );

  const allReady = playersList.length >= 2 && playersList.every((p) => p.ready);

  return (
    <div style={styles.container} data-testid="lobby-active-container">
      <header style={styles.header}>
        <h1 style={styles.title}>Game Lobby</h1>
        <div style={styles.codeContainer}>
          <span style={styles.codeLabel}>Game Code:</span>
          <strong style={styles.codeBadge} data-testid="game-code-display">{game.gameId}</strong>
          <button
            type="button"
            onClick={handleCopyCode}
            style={styles.btnCopy}
            data-testid="copy-code-btn"
          >
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>
        <p style={styles.subtitle}>
          Phase: <strong>{game.phase.toUpperCase()}</strong>
        </p>
      </header>

      {errorMessage && (
        <div style={styles.errorBox} data-testid="lobby-error">
          {errorMessage}
        </div>
      )}

      {/* Local Player Color Selection in Lobby */}
      {localPlayer && (
        <section style={styles.card}>
          <h3>Your Identity ({localPlayer.displayName})</h3>
          <p style={styles.mutedText}>Select your train color. Taken colors are disabled.</p>
          <div style={styles.colorGrid}>
            {PLAYER_COLORS.map((c) => {
              const isTaken = takenColors.has(c.toLowerCase());
              const isMine = localPlayer.color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  disabled={isTaken}
                  onClick={() => onSelectColor(c)}
                  style={{
                    ...styles.colorSwatch,
                    backgroundColor: c,
                    opacity: isTaken ? 0.3 : 1,
                    cursor: isTaken ? 'not-allowed' : 'pointer',
                    border: isMine ? '3px solid #1a202c' : '2px solid #cbd5e0',
                    transform: isMine ? 'scale(1.1)' : 'scale(1)',
                  }}
                  data-testid={`lobby-color-btn-${c}`}
                  title={isTaken ? 'Color already taken' : 'Select color'}
                />
              );
            })}
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={onToggleReady}
              style={localPlayer.ready ? styles.btnSuccess : styles.btnWarning}
              data-testid="toggle-ready-btn"
            >
              {localPlayer.ready ? '✓ Ready' : 'Mark as Ready'}
            </button>
          </div>
        </section>
      )}

      {/* Players List */}
      <section style={styles.card}>
        <h3>Players in Lobby ({playersList.length}/6)</h3>
        <div style={styles.playersListContainer} data-testid="players-list">
          {playersList.map((p) => (
            <div key={p.playerId} style={styles.playerCard} data-testid={`player-row-${p.playerId}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    border: '1px solid #a0aec0',
                  }}
                />
                <span style={{ fontWeight: 'bold' }}>{p.displayName}</span>
                {p.playerId === localPlayerId && <span style={styles.badgeYou}>(You)</span>}
              </div>
              <div>
                <span
                  style={p.ready ? styles.badgeReady : styles.badgeNotReady}
                  data-testid={`ready-status-${p.playerId}`}
                >
                  {p.ready ? 'READY' : 'NOT READY'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={onStartGame}
            disabled={!allReady}
            style={{
              ...styles.btnPrimary,
              opacity: allReady ? 1 : 0.5,
              cursor: allReady ? 'pointer' : 'not-allowed',
            }}
            data-testid="start-game-btn"
          >
            Start Game
          </button>
          {onLeaveGame && (
            <button
              type="button"
              onClick={onLeaveGame}
              style={styles.btnSecondary}
              data-testid="leave-lobby-btn"
            >
              Leave Lobby
            </button>
          )}
          {!allReady && (
            <p style={styles.mutedTextSmall}>
              Requires at least 2 players and all players marked as READY to start.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#2d3748',
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  title: {
    fontSize: '28px',
    margin: 0,
    color: '#1a202c',
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    color: '#718096',
  },
  codeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '4px 0',
  },
  codeLabel: {
    fontSize: '14px',
    color: '#4a5568',
  },
  codeBadge: {
    fontSize: '18px',
    letterSpacing: '1px',
    backgroundColor: '#edf2f7',
    padding: '4px 10px',
    borderRadius: '6px',
    color: '#2b6cb0',
  },
  btnCopy: {
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: '#e2e8f0',
    color: '#2d3748',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  errorBox: {
    backgroundColor: '#fed7d7',
    color: '#9b2c2c',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    margin: '0 0 16px 0',
    fontSize: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#4a5568',
  },
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e0',
    fontSize: '15px',
  },
  colorGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  colorSwatch: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  btnPrimary: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
  },
  btnSecondary: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnSuccess: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#38a169',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
  },
  btnWarning: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#dd6b20',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
  },
  mutedText: {
    fontSize: '14px',
    color: '#718096',
    margin: '4px 0 12px 0',
  },
  mutedTextSmall: {
    fontSize: '12px',
    color: '#a0aec0',
    marginTop: '4px',
  },
  playersListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '12px',
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    border: '1px solid #edf2f7',
  },
  badgeYou: {
    fontSize: '12px',
    color: '#3182ce',
    fontWeight: 'normal',
  },
  badgeReady: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#276749',
    backgroundColor: '#c6f6d5',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  badgeNotReady: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#9b2c2c',
    backgroundColor: '#fed7d7',
    padding: '4px 8px',
    borderRadius: '6px',
  },
};
