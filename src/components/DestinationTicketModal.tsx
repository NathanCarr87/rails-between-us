import React, { useState } from 'react';
import type { City, DestinationTicket } from '../game/model/types';

export interface DestinationTicketModalProps {
  pendingTickets: DestinationTicket[];
  cities: Record<string, City>;
  onConfirmSelection: (keptTicketIds: string[]) => void;
  minKeep?: number;
}

export const DestinationTicketModal: React.FC<DestinationTicketModalProps> = ({
  pendingTickets,
  cities,
  onConfirmSelection,
  minKeep = 1,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    pendingTickets.map((t) => t.id)
  );

  const toggleSelection = (ticketId: string) => {
    setSelectedIds((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const isCountValid = selectedIds.length >= minKeep;

  const handleConfirm = () => {
    if (!isCountValid) return;
    onConfirmSelection(selectedIds);
  };

  if (!pendingTickets || pendingTickets.length === 0) {
    return null;
  }

  return (
    <div style={styles.overlay} data-testid="destination-ticket-modal">
      <div style={styles.modal}>
        <h2 style={styles.title}>Select Destination Tickets</h2>
        <p style={styles.subtitle}>
          Choose at least {minKeep} ticket{minKeep > 1 ? 's' : ''} to keep. Unselected tickets will be returned to the deck.
        </p>

        <div style={styles.ticketList}>
          {pendingTickets.map((ticket) => {
            const isChecked = selectedIds.includes(ticket.id);
            const cityAName = cities[ticket.cityA]?.name || ticket.cityA;
            const cityBName = cities[ticket.cityB]?.name || ticket.cityB;

            return (
              <div
                key={ticket.id}
                style={{
                  ...styles.ticketItem,
                  borderColor: isChecked ? '#3182ce' : '#e2e8f0',
                  backgroundColor: isChecked ? '#ebf8ff' : '#ffffff',
                }}
                onClick={() => toggleSelection(ticket.id)}
                data-testid={`pending-ticket-${ticket.id}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelection(ticket.id)}
                  style={styles.checkbox}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={styles.ticketDetails}>
                  <span style={styles.routeText}>
                    <strong>{cityAName}</strong> ➔ <strong>{cityBName}</strong>
                  </span>
                  <span style={styles.pointsBadge}>{ticket.points} pts</span>
                </div>
              </div>
            );
          })}
        </div>

        {!isCountValid && (
          <p style={styles.warningText}>
            You must select at least {minKeep} ticket{minKeep > 1 ? 's' : ''}.
          </p>
        )}

        <div style={styles.actions}>
          <button
            style={{
              ...styles.confirmBtn,
              opacity: isCountValid ? 1 : 0.5,
              cursor: isCountValid ? 'pointer' : 'not-allowed',
            }}
            disabled={!isCountValid}
            onClick={handleConfirm}
            data-testid="confirm-tickets-btn"
          >
            Confirm Ticket Selection ({selectedIds.length} kept)
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    color: '#1a202c',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#718096',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  ticketItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.15s ease',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  ticketDetails: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  routeText: {
    fontSize: '15px',
    color: '#2d3748',
  },
  pointsBadge: {
    fontWeight: 'bold',
    fontSize: '13px',
    backgroundColor: '#edf2f7',
    color: '#2b6cb0',
    padding: '4px 8px',
    borderRadius: '12px',
  },
  warningText: {
    margin: 0,
    color: '#e53e3e',
    fontSize: '13px',
    fontWeight: '500',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  confirmBtn: {
    padding: '10px 20px',
    backgroundColor: '#3182ce',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
  },
};
