import React, { useEffect, useState } from 'react';
import type { Order, OrderStatus } from '../shared/types';
import { formatDistanceToNowStrict } from 'date-fns';

interface OrderTicketProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  isConnected: boolean;
  isSelected?: boolean;
  /** When true, renders the compressed Completed Log variant */
  isCompact?: boolean;
}

export const OrderTicket: React.FC<OrderTicketProps> = React.memo(
  ({ order, onStatusChange, isConnected, isSelected = false, isCompact = false }) => {
    const [timeSince, setTimeSince] = useState('');
    const [minutesOld, setMinutesOld] = useState(0);

    useEffect(() => {
      const updateTime = () => {
        const created = new Date(order.createdAt);
        setTimeSince(formatDistanceToNowStrict(created));
        setMinutesOld((Date.now() - created.getTime()) / 60000);
      };
      updateTime();
      const interval = setInterval(updateTime, 5000);
      return () => clearInterval(interval);
    }, [order.createdAt]);

    // ── COMPACT variant: right-panel Completed Log ────────────────────────────
    if (isCompact) {
      return (
        <div
          className="ticket-enter"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid var(--status-ready)',
            borderRadius: '6px',
            padding: '0.65rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          {/* Table + badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              #{order.tableNumber}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--status-ready)', fontWeight: 700, letterSpacing: '0.04em' }}>
              [ READY ]
            </span>
          </div>

          {/* Ready for pickup label */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--status-ready)', letterSpacing: '0.04em' }}>
            READY FOR PICKUP
          </div>

          {/* Compact item list */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {order.items.map((item, idx) => (
              <div key={idx}>{item.quantity}× {item.name}</div>
            ))}
          </div>

          {/* Age */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)' }}>
            {timeSince}
          </div>

          {/* Serve & Archive button */}
          <button
            disabled={!isConnected}
            onClick={() => onStatusChange(order._id, 'served')}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginTop: '0.25rem',
              backgroundColor: isConnected ? 'rgba(34,197,94,0.12)' : 'transparent',
              color: isConnected ? 'var(--status-ready)' : 'var(--text-dim)',
              border: `1px solid ${isConnected ? 'var(--status-ready)' : 'var(--border)'}`,
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              transition: 'all 120ms',
            }}
          >
            SERVE &amp; ARCHIVE
          </button>
        </div>
      );
    }

    // ── FULL variant: left-panel Active Queue ─────────────────────────────────
    const borderColor = `var(--status-${order.status})`;

    let timeColor = 'var(--text-muted)';
    let agingClass = '';

    if (minutesOld >= 13) {
      timeColor = 'var(--status-crimson)';
      agingClass = 'ticket-aging-crimson';
    } else if (minutesOld >= 9) {
      timeColor = 'var(--status-amber)';
      agingClass = 'ticket-aging-amber';
    }

    const baseClass  = 'ticket-enter';
    const selectedClass = isSelected ? 'ticket-bump-selected' : '';
    const containerClasses = [baseClass, agingClass, selectedClass].filter(Boolean).join(' ');

    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: `6px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          transition: 'border-left-color 200ms ease',
          height: '100%',
        }}
        className={containerClasses}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
            #{order.tableNumber}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: timeColor, fontWeight: 500 }}>
              {timeSince}
            </div>
            {isSelected && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--status-received)', fontWeight: 700, letterSpacing: '0.05em' }}>
                [ SELECTED ]
              </div>
            )}
          </div>
        </div>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
          {order.items.map((item, idx) => (
            <li key={idx} style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', fontWeight: 500 }}>
                <span>{item.quantity}x</span>
                <span>{item.name}</span>
              </div>
              {item.notes && (
                <div style={{
                  fontStyle: 'italic',
                  color: 'var(--status-received)',
                  fontSize: '0.875rem',
                  paddingLeft: '1.5rem',
                  marginTop: '0.25rem',
                }}>
                  {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 'auto' }}>
          {order.status === 'received' && (
            <button
              disabled={!isConnected}
              onClick={() => onStatusChange(order._id, 'cooking')}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: 'var(--status-cooking)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '6px',
                opacity: isConnected ? 1 : 0.5,
                cursor: isConnected ? 'pointer' : 'not-allowed',
              }}
            >
              Start Cooking
            </button>
          )}
          {order.status === 'cooking' && (
            <button
              disabled={!isConnected}
              onClick={() => onStatusChange(order._id, 'ready')}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: 'var(--status-ready)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '6px',
                opacity: isConnected ? 1 : 0.5,
                cursor: isConnected ? 'pointer' : 'not-allowed',
              }}
            >
              Mark as Ready
            </button>
          )}
        </div>
      </div>
    );
  }
);
