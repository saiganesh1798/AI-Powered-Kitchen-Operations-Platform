import React from 'react';
import type { OrderStatus } from '../shared/types';

interface StatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; colorClass: string }> = {
  received: { label: 'RECEIVED', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  cooking: { label: 'COOKING', colorClass: 'bg-red-500/10 text-red-500 border-red-500/20' },
  ready: { label: 'READY', colorClass: 'bg-green-500/10 text-green-500 border-green-500/20' },
  served: { label: 'SERVED', colorClass: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      border: '1px solid',
      borderRadius: '4px',
      color: `var(--status-${status})`,
      borderColor: `color-mix(in srgb, var(--status-${status}) 20%, transparent)`,
      backgroundColor: `color-mix(in srgb, var(--status-${status}) 10%, transparent)`,
    }}>
      {config.label}
    </span>
  );
};
