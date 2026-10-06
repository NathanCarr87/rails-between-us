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
        <h3 style={styles.title}>Train Car Card Display</h3>
        {isCurrentTurn ? (
          <span style={styles.drawStatusBadge} data-testid="draw-status-badge">
            {cardsDrawnThisTurn === 1 ? 'Select 2nd Card' : 'Your Turn to Draw'}
          </span>
        ) : (
          <span style={styles.waitingBadge}>Waiting for Turn</span>
        )}
      </div>

      <div style={styles.cardRow}>
        {/* Blind Draw Deck Card */}
        <button
          style={{
            ...styles.deckCard,
            opacity: isCurrentTurn && deckCount > 0 ? 1 : 0.6,
            cursor: isCurrentTurn && deckCount > 0 ? 'pointer' : 'not-allowed',
          }}
          onClick={() => isCurrentTurn && deckCount > 0 && onDrawDeckCard?.()}
          disabled={!isCurrentTurn || deckCount === 0}
          data-testid="draw-deck-btn"
          title="Draw blind card from deck"
        >
          <span style={styles.deckTitle}>Draw Deck</span>
          <span style={styles.deckCount}>{deckCount} cards</span>
          <span style={styles.deckSub}>Blind Draw</span>
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
                border: isLoco ? '3px solid #f6e05e' : '2px solid #cbd5e0',
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
              {isLoco && <span style={styles.wildBanner}>★ WILD ★</span>}
              <span style={styles.cardName}>{colorMeta.label}</span>
              <span style={styles.cardIndex}>#{index + 1}</span>
            </button>
          );
        })}

        {/* Discard Pile Badge */}
        <div style={styles.discardCard} data-testid="discard-pile-info">
          <span style={styles.discardTitle}>Discard Pile</span>
          <span style={styles.discardCount}>{discardCount} cards</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#2d3748',
  },
  drawStatusBadge: {
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  waitingBadge: {
    fontSize: '12px',
    color: '#718096',
    backgroundColor: '#edf2f7',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  cardRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: '10px',
    alignItems: 'stretch',
  },
  deckCard: {
    backgroundColor: '#2b6cb0',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    border: '2px solid #2c5282',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
    transition: 'transform 0.1s ease',
  },
  deckTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  deckCount: {
    fontSize: '16px',
    fontWeight: '800',
  },
  deckSub: {
    fontSize: '10px',
    opacity: 0.85,
  },
  faceUpCard: {
    borderRadius: '10px',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
    position: 'relative',
    minHeight: '80px',
    transition: 'transform 0.1s ease',
  },
  wildBanner: {
    fontSize: '10px',
    fontWeight: '900',
    backgroundColor: '#1a202c',
    color: '#f6e05e',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '1px',
  },
  cardName: {
    fontSize: '13px',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardIndex: {
    fontSize: '11px',
    opacity: 0.8,
  },
  discardCard: {
    backgroundColor: '#edf2f7',
    color: '#4a5568',
    borderRadius: '10px',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    border: '1px dashed #cbd5e0',
  },
  discardTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#718096',
  },
  discardCount: {
    fontSize: '15px',
    fontWeight: 'bold',
  },
};
