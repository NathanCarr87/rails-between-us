// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
import { PlayerHand } from '../PlayerHand';
import type { TrainCard } from '../../game/model/types';

describe('PlayerHand Component', () => {
  it('renders empty hand message when no cards are held', () => {
    render(<PlayerHand cards={[]} />);
    expect(screen.getByText(/You have no train cards in hand/i)).toBeDefined();
  });

  it('renders cards grouped by color with correct counts', () => {
    const mockCards: TrainCard[] = [
      { id: '1', color: 'red' },
      { id: '2', color: 'red' },
      { id: '3', color: 'blue' },
      { id: '4', color: 'locomotive' },
    ];

    render(<PlayerHand cards={mockCards} isCurrentTurn={true} />);

    expect(screen.getByText('Your Hand (4 cards)')).toBeDefined();
    expect(screen.getByText('Your Turn')).toBeDefined();

    const redBadge = screen.getByTestId('hand-card-red');
    expect(redBadge.textContent).toContain('Red');
    expect(redBadge.textContent).toContain('2');

    const blueBadge = screen.getByTestId('hand-card-blue');
    expect(blueBadge.textContent).toContain('Blue');
    expect(blueBadge.textContent).toContain('1');

    const locoBadge = screen.getByTestId('hand-card-locomotive');
    expect(locoBadge.textContent).toContain('Locomotive (Wild)');
    expect(locoBadge.textContent).toContain('1');
  });

  it('allows color selection when onSelectColor callback is provided', () => {
    const mockCards: TrainCard[] = [
      { id: '1', color: 'red' },
    ];
    const handleSelectColor = vi.fn();

    render(
      <PlayerHand
        cards={mockCards}
        selectedColor="red"
        onSelectColor={handleSelectColor}
      />
    );

    const blueBadge = screen.getByTestId('hand-card-blue');
    fireEvent.click(blueBadge);

    expect(handleSelectColor).toHaveBeenCalledWith('blue');
  });
});
