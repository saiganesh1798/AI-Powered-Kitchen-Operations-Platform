import React from 'react';
import { useOrders } from '../hooks/useOrders';
import { OrderTicket } from '../components/OrderTicket';
import { Wifi, WifiOff } from 'lucide-react';
import { useBumpBar } from '../hooks/useBumpBar';
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { VoiceCommandConsole } from '../components/VoiceCommandConsole';
import { AIPrepSummary } from '../components/AIPrepSummary';
import type { StationFilter } from '../../../shared/types';

export const KitchenDisplay: React.FC = () => {
  const { orders, updateStatus, isConnected, inventoryAlert } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeStation, setActiveStation] = useState<StationFilter>('all');

  const STATIONS: StationFilter[] = ['all', 'grill', 'fry', 'prep', 'assembly'];

  // Calculate priority bucket: 2 for 13+ mins, 1 for 9-12 mins, 0 for <9 mins
  const getPriority = (createdAt: string) => {
    const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
    if (mins >= 13) return 2;
    if (mins >= 9) return 1;
    return 0;
  };

  // Active queue: received + cooking, filtered by station, sorted by urgency then age
  const activeOrders = [...orders]
    .filter(o => o.status === 'received' || o.status === 'cooking')
    .filter(o =>
      activeStation === 'all'
        ? true
        : o.items.some(item => (item.station ?? 'assembly') === activeStation)
    )
    .sort((a, b) => {
      const pA = getPriority(a.createdAt);
      const pB = getPriority(b.createdAt);
      if (pA !== pB) return pB - pA;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Completed log: ready orders, oldest first
  const completedOrders = [...orders]
    .filter(o => o.status === 'ready')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleSelectOldest = useCallback(() => {
    if (activeOrders.length > 0) {
      const oldest = activeOrders.reduce((prev, curr) =>
        new Date(prev.createdAt).getTime() < new Date(curr.createdAt).getTime() ? prev : curr
      );
      setSelectedOrderId(oldest._id);
    }
  }, [activeOrders]);

  const handleTriggerAction = useCallback(() => {
    if (!selectedOrderId) return;
    const order = activeOrders.find(o => o._id === selectedOrderId);
    if (!order) return;
    if (order.status === 'received') updateStatus(order._id, 'cooking');
    else if (order.status === 'cooking') updateStatus(order._id, 'ready');
  }, [selectedOrderId, activeOrders, updateStatus]);

  const handleArchive = useCallback(() => {
    // Spacebar archives oldest ready ticket from the completed log
    if (completedOrders.length === 0) return;
    const oldest = completedOrders[0];
    updateStatus(oldest._id, 'served');
  }, [completedOrders, updateStatus]);

  useBumpBar({
    onSelectOldest: handleSelectOldest,
    onTriggerAction: handleTriggerAction,
    onArchive: handleArchive,
    isActive: isConnected
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header bar */}
      <header style={{
        backgroundColor: 'var(--bg-elevated)',
        padding: '1rem 2rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          KITCHEN DISPLAY SYSTEM
          <Link to="/analytics" style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textDecoration: 'none' }}>
            [VIEW ANALYTICS]
          </Link>
          <Link to="/order" style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--status-received)', textDecoration: 'none' }}>
            [+ NEW ORDER]
          </Link>
          {/* Station filter matrix */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            {STATIONS.map(s => (
              <button
                key={s}
                onClick={() => setActiveStation(s)}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  border: 'none',
                  borderRight: '1px solid var(--border)',
                  backgroundColor: activeStation === s ? 'var(--status-received)' : 'var(--bg-elevated)',
                  color: activeStation === s ? '#000' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)' }}>
          {/* ── Voice Command Console ── */}
          <VoiceCommandConsole
            orders={orders}
            updateStatus={updateStatus}
            isConnected={isConnected}
          />
          {/* ── Connection status ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {isConnected ? (
              <>
                <Wifi size={16} color="var(--status-ready)" />
                <span style={{ color: 'var(--status-ready)', fontWeight: 500, fontSize: '0.75rem' }}>CONNECTED</span>
              </>
            ) : (
              <>
                <WifiOff size={16} color="var(--status-cooking)" />
                <span style={{ color: 'var(--status-cooking)', fontWeight: 500, fontSize: '0.75rem' }}>DISCONNECTED</span>
              </>
            )}
          </div>
        </div>
      </header>

      <AIPrepSummary />

      {/* Inventory Alert Banner */}
      {inventoryAlert && (
        <div style={{
          backgroundColor: 'rgba(245,158,11,0.12)',
          borderBottom: '1px solid var(--status-amber)',
          color: 'var(--status-amber)',
          padding: '0.5rem 1.5rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}>
          ⚠ {inventoryAlert}
        </div>
      )}

      {/* Disconnect Banner */}
      {!isConnected && (
        <div style={{
          backgroundColor: 'var(--status-cooking)',
          color: '#fff',
          textAlign: 'center',
          padding: '0.5rem',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em'
        }}>
          CONNECTION LOST — RECONNECTING...
        </div>
      )}

      {/* Dual-Panel Board */}
      <div style={{ flexGrow: 1, display: 'grid', gridTemplateColumns: '1fr 220px', overflow: 'hidden' }}>

        {/* ── LEFT: Active Queue (80%) ── */}
        <main style={{
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}>
          {/* Panel header */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>ACTIVE QUEUE — {activeOrders.length} ticket{activeOrders.length !== 1 ? 's' : ''}</span>
            {activeStation !== 'all' && (
              <span style={{ color: 'var(--status-received)' }}>[ STATION: {activeStation.toUpperCase()} ]</span>
            )}
          </div>

          {activeOrders.length === 0 && isConnected ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '4rem', fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>
              NO ACTIVE ORDERS
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', alignContent: 'start' }}>
              {activeOrders.map(order => (
                <OrderTicket
                  key={order._id}
                  order={order}
                  onStatusChange={updateStatus}
                  isConnected={isConnected}
                  isSelected={order._id === selectedOrderId}
                />
              ))}
            </div>
          )}
        </main>

        {/* ── RIGHT: Completed Log (20%) ── */}
        <aside style={{
          borderLeft: '1px solid var(--border)',
          backgroundColor: 'var(--bg-surface)',
          overflowY: 'auto',
          padding: '1rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          {/* Panel header */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--status-ready)', letterSpacing: '0.1em', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            COMPLETED LOG — {completedOrders.length}
          </div>

          {completedOrders.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '1.5rem', lineHeight: 1.8 }}>
              [ EMPTY ]<br />Completed orders<br />appear here
            </div>
          ) : (
            completedOrders.map(order => (
              <OrderTicket
                key={order._id}
                order={order}
                onStatusChange={updateStatus}
                isConnected={isConnected}
                isSelected={false}
                isCompact
              />
            ))
          )}
        </aside>

      </div>
    </div>
  );
};
