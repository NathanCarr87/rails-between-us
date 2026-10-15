// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DestinationTicketDetailModal } from '../DestinationTicketDetailModal';
import { DEFAULT_CITIES, DEFAULT_ROUTES } from '../../game/rules/defaults';

afterEach(() => {
  cleanup();
});

describe('DestinationTicketDetailModal', () => {
  const sampleTicket = {
    id: 'ticket_boston_miami',
    cityA: 'boston',
    cityB: 'miami',
    points: 12,
  };

  it('renders ticket details: cities, points, completion status, and visual map', () => {
    render(
      <DestinationTicketDetailModal
        ticket={sampleTicket}
        cities={DEFAULT_CITIES}
        routes={DEFAULT_ROUTES}
        claimedRoutes={[]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('destination-ticket-detail-modal')).toBeDefined();
    expect(screen.getByText('Boston')).toBeDefined();
    expect(screen.getByText('Miami')).toBeDefined();
    expect(screen.getByTestId('ticket-detail-points').textContent).toContain('12');
    expect(screen.getByTestId('ticket-detail-status').textContent).toContain('Incomplete');
  });

  it('shows completed status when ticket routes are completed in claimedRoutes', () => {
    render(
      <DestinationTicketDetailModal
        ticket={{ id: 't1', cityA: 'boston', cityB: 'new_york', points: 6 }}
        cities={DEFAULT_CITIES}
        routes={DEFAULT_ROUTES}
        claimedRoutes={['route_boston_new_york_red']}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('ticket-detail-status').textContent).toContain('Completed');
  });

  it('calls onClose when top close button or footer close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <DestinationTicketDetailModal
        ticket={sampleTicket}
        cities={DEFAULT_CITIES}
        routes={DEFAULT_ROUTES}
        claimedRoutes={[]}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByTestId('close-ticket-detail-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const footerCloseBtn = screen.getByTestId('close-ticket-detail-footer-btn');
    fireEvent.click(footerCloseBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when pressing the Escape key', () => {
    const handleClose = vi.fn();
    render(
      <DestinationTicketDetailModal
        ticket={sampleTicket}
        cities={DEFAULT_CITIES}
        routes={DEFAULT_ROUTES}
        claimedRoutes={[]}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop overlay is clicked', () => {
    const handleClose = vi.fn();
    render(
      <DestinationTicketDetailModal
        ticket={sampleTicket}
        cities={DEFAULT_CITIES}
        routes={DEFAULT_ROUTES}
        claimedRoutes={[]}
        onClose={handleClose}
      />
    );

    const overlay = screen.getByTestId('destination-ticket-detail-modal');
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
