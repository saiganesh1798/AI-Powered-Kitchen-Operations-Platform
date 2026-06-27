import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { ArrowLeft, RefreshCw, Calendar, CheckCircle2, Clock, AlertTriangle, Package, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface HistoryItem {
  name: string;
  quantity: number;
  notes?: string;
  station?: string;
}

interface HistoryOrder {
  _id: string;
  tableNumber: number;
  items: HistoryItem[];
  status: string;
  createdAt: string;
  readyAt?: string;
  cookingStartedAt?: string;
  phone?: string;
  prepDurationMs: number | null;
  cookDurationMs: number | null;
  totalItems: number;
  slaBreached: boolean;
}

interface HistoryResponse {
  date: string;
  totalServed: number;
  breachCount: number;
  avgPrepMinutes: number;
  orders: HistoryOrder[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMs(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return format(new Date(iso), 'HH:mm:ss');
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}> = ({ icon, label, value, sub, accent = 'var(--text-primary)' }) => (
  <div style={{
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.08em' }}>
      {icon}
      {label}
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: accent, lineHeight: 1 }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
        {sub}
      </div>
    )}
  </div>
);

// ── Order row ────────────────────────────────────────────────────────────────
const OrderRow: React.FC<{ order: HistoryOrder }> = ({ order }) => {
  const [expanded, setExpanded] = useState(false);

  const borderAccent = order.slaBreached ? 'var(--status-crimson)' : 'var(--status-ready)';

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${borderAccent}`,
      borderRadius: '6px',
      overflow: 'hidden',
      transition: 'border-color 150ms',
    }}>
      {/* ── Summary row ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '3rem 1fr 7rem 7rem 7rem 7rem 2rem',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.85rem 1.25rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Table # */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          T{order.tableNumber}
        </span>

        {/* Items summary */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.items.map(i => `${i.quantity}× ${i.name}`).join('  ·  ')}
        </span>

        {/* Served time */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>READY AT</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{fmtTime(order.readyAt)}</div>
        </div>

        {/* Total prep */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>TOTAL PREP</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: order.slaBreached ? 'var(--status-crimson)' : 'var(--status-ready)', fontWeight: 600 }}>
            {fmtMs(order.prepDurationMs)}
          </div>
        </div>

        {/* Cook time */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>COOK TIME</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            {fmtMs(order.cookDurationMs)}
          </div>
        </div>

        {/* SLA badge */}
        <div style={{ textAlign: 'right' }}>
          {order.slaBreached ? (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700,
              color: 'var(--status-crimson)', border: '1px solid var(--status-crimson)',
              borderRadius: '3px', padding: '0.15rem 0.4rem', letterSpacing: '0.05em',
            }}>
              SLA BREACH
            </span>
          ) : (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700,
              color: 'var(--status-ready)', border: '1px solid var(--status-ready)',
              borderRadius: '3px', padding: '0.15rem 0.4rem', letterSpacing: '0.05em',
            }}>
              ON TIME
            </span>
          )}
        </div>

        {/* Chevron */}
        <span style={{ color: 'var(--text-dim)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '1rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          backgroundColor: 'var(--bg-elevated)',
          animation: 'slideDown 120ms ease-out',
        }}>
          {/* Item breakdown */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
              ITEMS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {order.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, minWidth: '1.5rem' }}>
                    {item.quantity}×
                  </span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)' }}>{item.name}</div>
                    {item.station && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--status-received)', marginTop: '0.1rem' }}>
                        [{item.station.toUpperCase()}]
                      </div>
                    )}
                    {item.notes && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.1rem' }}>
                        {item.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
              TIMELINE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'ORDER RECEIVED',   time: order.createdAt,        color: 'var(--status-received)' },
                { label: 'COOKING STARTED',  time: order.cookingStartedAt, color: 'var(--status-cooking)'  },
                { label: 'MARKED READY',     time: order.readyAt,          color: 'var(--status-ready)'    },
              ].map(({ label, time, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color, fontWeight: 600 }}>
                    {fmtTime(time)}
                  </span>
                </div>
              ))}
              {order.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>PHONE</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-primary)' }}>{order.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Main Page ────────────────────────────────────────────────────────────────
export const OrderHistory: React.FC = () => {
  const [data, setData]         = useState<HistoryResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [date, setDate]         = useState<string>(todayISO());
  const [filter, setFilter]     = useState<'all' | 'breach' | 'ontime'>('all');
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetch_ = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/api/orders/history?date=${d}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as HistoryResponse;
      setData(json);
      setLastFetched(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(date); }, [date, fetch_]);

  // Auto-refresh every 30s when viewing today
  useEffect(() => {
    if (date !== todayISO()) return;
    const interval = setInterval(() => fetch_(date), 30000);
    return () => clearInterval(interval);
  }, [date, fetch_]);

  const visibleOrders = (data?.orders ?? []).filter(o => {
    if (filter === 'breach') return o.slaBreached;
    if (filter === 'ontime') return !o.slaBreached;
    return true;
  });

  const isToday = date === todayISO();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <header style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
              color: 'var(--text-muted)', textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            <ArrowLeft size={14} />
            BACK TO KDS
          </Link>
          <h1 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            ORDER HISTORY
          </h1>
          {isToday && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
              color: 'var(--status-ready)', border: '1px solid var(--status-ready)',
              borderRadius: '3px', padding: '0.15rem 0.5rem', letterSpacing: '0.06em',
            }}>
              LIVE TODAY
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Date picker */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            border: '1px solid var(--border)', borderRadius: '4px',
            padding: '0.3rem 0.65rem', backgroundColor: 'var(--bg-surface)',
          }}>
            <Calendar size={13} color="var(--text-muted)" />
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={e => setDate(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetch_(date)}
            disabled={loading}
            title="Refresh"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.65rem', border: '1px solid var(--border)',
              borderRadius: '4px', backgroundColor: 'var(--bg-surface)',
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              color: loading ? 'var(--text-dim)' : 'var(--text-muted)',
              cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em',
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'LOADING…' : 'REFRESH'}
          </button>

          {lastFetched && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)' }}>
              Updated {formatDistanceToNowStrict(lastFetched)} ago
            </span>
          )}
        </div>
      </header>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(220,38,38,0.1)', borderBottom: '1px solid var(--status-crimson)',
          color: 'var(--status-crimson)', padding: '0.6rem 1.5rem',
          fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0,
        }}>
          ✘ {error}
        </div>
      )}

      {/* ── Stat cards ── */}
      {data && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <StatCard
            icon={<CheckCircle2 size={13} />}
            label="ORDERS SERVED"
            value={data.totalServed}
            sub={`on ${format(new Date(data.date + 'T12:00:00'), 'dd MMM yyyy')}`}
            accent="var(--status-ready)"
          />
          <StatCard
            icon={<Clock size={13} />}
            label="AVG PREP TIME"
            value={`${data.avgPrepMinutes}m`}
            sub="order placed → marked ready"
            accent={data.avgPrepMinutes > 12 ? 'var(--status-crimson)' : 'var(--text-primary)'}
          />
          <StatCard
            icon={<AlertTriangle size={13} />}
            label="SLA BREACHES"
            value={data.breachCount}
            sub={data.totalServed > 0 ? `${Math.round(data.breachCount / data.totalServed * 100)}% breach rate` : '—'}
            accent={data.breachCount > 0 ? 'var(--status-crimson)' : 'var(--status-ready)'}
          />
          <StatCard
            icon={<Package size={13} />}
            label="ON-TIME ORDERS"
            value={data.totalServed - data.breachCount}
            sub={data.totalServed > 0 ? `${Math.round((data.totalServed - data.breachCount) / data.totalServed * 100)}% compliance` : '—'}
            accent="var(--status-ready)"
          />
        </div>
      )}

      {/* ── Filter strip + table ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Column headers + filter */}
        {data && data.orders.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            {/* Filter tabs */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              {(['all', 'ontime', 'breach'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700,
                    letterSpacing: '0.06em', border: 'none',
                    borderRight: '1px solid var(--border)',
                    backgroundColor: filter === f
                      ? f === 'breach' ? 'var(--status-crimson)' : 'var(--status-ready)'
                      : 'var(--bg-elevated)',
                    color: filter === f ? '#000' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 120ms',
                  }}
                >
                  {f === 'all' ? `ALL (${data.orders.length})` : f === 'ontime' ? `ON-TIME (${data.totalServed - data.breachCount})` : `BREACH (${data.breachCount})`}
                </button>
              ))}
            </div>

            {/* Column labels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '3rem 1fr 7rem 7rem 7rem 7rem 2rem',
              gap: '1rem',
              paddingRight: '1.25rem',
              fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
              color: 'var(--text-dim)', letterSpacing: '0.08em',
              width: '100%', marginLeft: '1rem',
            }}>
              <span>TABLE</span>
              <span>ITEMS</span>
              <span style={{ textAlign: 'right' }}>READY AT</span>
              <span style={{ textAlign: 'right' }}>TOTAL PREP</span>
              <span style={{ textAlign: 'right' }}>COOK TIME</span>
              <span style={{ textAlign: 'right' }}>SLA</span>
              <span />
            </div>
          </div>
        )}

        {/* Order rows */}
        {loading && !data && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              LOADING HISTORY…
            </span>
          </div>
        )}

        {!loading && data && data.orders.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={40} color="var(--text-dim)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
              NO SERVED ORDERS FOR {date.toUpperCase()}
            </span>
            {isToday && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                Complete and archive orders from the kitchen display to see them here.
              </span>
            )}
          </div>
        )}

        {!loading && visibleOrders.length === 0 && data && data.orders.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '2rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            No orders match the &quot;{filter}&quot; filter.
          </div>
        )}

        {visibleOrders.map(order => (
          <OrderRow key={order._id} order={order} />
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
      `}</style>
    </div>
  );
};
