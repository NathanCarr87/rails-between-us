import React from 'react';
import type { CardColor, TrainCard } from '../game/model/types';

export interface FaceUpCardsProps {
  faceUpCards: TrainCard[];
  deckCount: number;
  discardCount: number;
  cardsDrawnThisTurn?: number;
  isCurrentTurn: boolean;
  onDrawFaceUpCard?: (index: number) => void;
  onDrawDeckCard?: () => void;
}

const COLOR_MAP: Record<CardColor, { bg: string; text: string; label: string }> = {
  red: { bg: '#e53e3e', text: '#ffffff', label: 'Red' },
  blue: { bg: '#3182ce', text: '#ffffff', label: 'Blue' },
  green: { bg: '#38a169', text: '#ffffff', label: 'Green' },
  yellow: { bg: '#d69e2e', text: '#1a202c', label: 'Yellow' },
  purple: { bg: '#805ad5', text: '#ffffff', label: 'Purple' },
  orange: { bg: '#dd6b20', text: '#ffffff', label: 'Orange' },
  black: { bg: '#2d3748', text: '#ffffff', label: 'Black' },
  white: { bg: '#ffffff', text: '#2d3748', label: 'White' },
  locomotive: {
    bg: 'linear-gradient(135deg, #e53e3e, #3182ce, #38a169, #d69e2e, #805ad5)',
    text: '#ffffff',
    label: 'Wild Locomotive 🚂',
  },
};

export const FaceUpCards: React.FC<FaceUpCardsProps> = ({
  faceUpCards = [],
  deckCount,
  discardCount,
  cardsDrawnThisTurn = 0,
  isCurrentTurn,
  onDrawFaceUpCard,
  onDrawDeckCard,
}) => {
  return (
    <div style={styles.container} data-testid="face-up-cards-container">
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h3 style={styles.title}>Card Display</h3>
          <span style={styles.secondaryCountText}>({deckCount} deck / {discardCount} discard)</span>
        </div>
        {isCurrentTurn ? (
          <span style={styles.drawStatusBadge} data-testid="draw-status-badge">
            {cardsDrawnThisTurn === 1 ? 'Select 2nd Card' : 'Your Turn'}
          </span>
        ) : (
          <span style={styles.waitingBadge}>Waiting</span>
        )}
      </div>

      <div style={styles.cardRow}>
        {/* Compact Blind Draw Deck Tile */}
        <button
          style={{
            ...styles.deckCard,
            opacity: isCurrentTurn && (deckCount > 0 || discardCount > 0) ? 1 : 0.6,
            cursor: isCurrentTurn && (deckCount > 0 || discardCount > 0) ? 'pointer' : 'not-allowed',
          }}
          onClick={() => isCurrentTurn && (deckCount > 0 || discardCount > 0) && onDrawDeckCard?.()}
          disabled={!isCurrentTurn || (deckCount === 0 && discardCount === 0)}
          data-testid="draw-deck-btn"
          title="Draw blind card from deck"
        >
          <span style={styles.deckIcon}>🎴</span>
          <span style={styles.deckTitle}>Draw Deck</span>
          <span style={styles.deckCountBadge}>{deckCount}</span>
        </button>

        {/* 5 Face-up Cards */}
        {faceUpCards.map((card, index) => {
          const colorMeta = COLOR_MAP[card.color] || COLOR_MAP.white;
          const isLoco = card.color === 'locomotive';
          const isLocoDisabled = isCurrentTurn && cardsDrawnThisTurn === 1 && isLoco;
          const canClick = isCurrentTurn && !isLocoDisabled;

          return (
            <button
              key={card.id || `face_up_${index}`}
              style={{
                ...styles.faceUpCard,
                background: colorMeta.bg,
                color: colorMeta.text,
                opacity: canClick ? 1 : 0.5,
                cursor: canClick ? 'pointer' : 'not-allowed',
                border: isLoco ? '2px solid #f6e05e' : '1px solid rgba(0,0,0,0.15)',
              }}
              onClick={() => canClick && onDrawFaceUpCard?.(index)}
              disabled={!canClick}
              data-testid={`face-up-card-${index}`}
              title={
                isLocoDisabled
                  ? 'Cannot take face-up Locomotive as 2nd card'
                  : isLoco
                  ? 'Locomotive (Wild card - takes full turn if drawn 1st)'
                  : `Take ${colorMeta.label} card`
              }
            >
              {isLoco && <span style={styles.wildBanner}>WILD</span>}
              <span style={styles.cardName}>{colorMeta.label.split(' ')[0]}</span>
            </button>
          );
        })}

        {/* Compact Discard Pile Info Tile */}
        <div style={styles.discardCard} data-testid="discard-pile-info" title="Discard pile count">
          <span style={styles.discardTitle}>Discard</span>
          <span style={styles.discardCount}>{discardCount}</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '10px 12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    border: '1px solid #e2e8f0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  secondaryCountText: {
    fontSize: '11px',
    color: '#718096',
  },
  drawStatusBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  waitingBadge: {
    fontSize: '11px',
    color: '#718096',
    backgroundColor: '#edf2f7',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  cardRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
    gap: '6px',
    alignItems: 'stretch',
  },
  deckCard: {
    backgroundColor: '#2b6cb0',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '8px 4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    border: '1px solid #2c5282',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    minHeight: '56px',
  },
  deckIcon: {
    fontSize: '12px',
    lineHeight: 1,
  },
  deckTitle: {
    fontSize: '10px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  deckCountBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.25)',
    padding: '1px 6px',
    borderRadius: '8px',
  },
  faceUpCard: {
    borderRadius: '8px',
    padding: '8px 4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
    position: 'relative',
    minHeight: '56px',
    minWidth: '50px',
  },
  wildBanner: {
    fontSize: '9px',
    fontWeight: 'bold',
    backgroundColor: '#1a202c',
    color: '#f6e05e',
    padding: '1px 4px',
    borderRadius: '3px',
    letterSpacing: '0.5px',
  },
  cardName: {
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  discardCard: {
    backgroundColor: '#f7fafc',
    color: '#4a5568',
    borderRadius: '8px',
    padding: '8px 4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    border: '1px dashed #cbd5e0',
    minHeight: '56px',
  },
  discardTitle: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
  },
  discardCount: {
    fontSize: '12px',
    fontWeight: 'bold',
  },
};
