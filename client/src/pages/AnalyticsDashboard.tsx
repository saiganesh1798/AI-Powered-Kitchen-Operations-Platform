import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, Clock, TrendingUp } from 'lucide-react';

interface PrepData {
  itemName: string;
  avgPrepDurationMinutes: number;
  count: number;
}

interface HourData {
  hour: number;
  totalOrders: number;
}

interface AnalyticsData {
  averagePreparationTimePerItem: PrepData[];
  ordersByHour: HourData[];
}

export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/analytics')
      .then(res => res.json())
      .then((json) => {
        if (json.averagePreparationTimePerItem && json.ordersByHour) {
          setData(json);
        } else {
          setError('Invalid data format received.');
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch analytics data. Is the server running?');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Activity className="animate-spin" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--status-cooking)', fontFamily: 'var(--font-mono)' }}>
        [ERROR] {error}
      </div>
    );
  }

  const maxPrepTime = Math.max(...(data?.averagePreparationTimePerItem.map(d => d.avgPrepDurationMinutes) || [0]), 1);
  const maxOrders = Math.max(...(data?.ordersByHour.map(d => d.totalOrders) || [0]), 1);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft size={20} />
          <span>[BACK]</span>
        </Link>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '1.5rem', letterSpacing: '0.05em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={24} color="var(--status-ready)" />
          SYSTEM METRICS
        </h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Prep Time Chart */}
        <section style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-amber)' }}>
            <Clock size={20} />
            AVG PREP TIME (MINUTES)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data?.averagePreparationTimePerItem.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No prep data available.</div>
            ) : (
              data?.averagePreparationTimePerItem.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.itemName} <span style={{color: 'var(--text-muted)'}}>({item.count} orders)</span></span>
                    <span style={{ color: 'var(--status-amber)', fontWeight: 'bold' }}>{item.avgPrepDurationMinutes.toFixed(1)}m</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-body)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${(item.avgPrepDurationMinutes / maxPrepTime) * 100}%`, 
                      height: '100%', 
                      backgroundColor: 'var(--status-amber)',
                      transition: 'width 1s ease-out'
                    }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Orders by Hour Histogram */}
        <section style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-ready)' }}>
            <TrendingUp size={20} />
            ORDER VOLUME BY HOUR
          </h2>
          {data?.ordersByHour.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No volume data available.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '250px', marginTop: 'auto', paddingTop: '2rem', borderBottom: '1px solid var(--border)' }}>
              {data?.ordersByHour.map((item, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%' }}>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.75rem', 
                    color: 'var(--status-ready)',
                    opacity: item.totalOrders > 0 ? 1 : 0
                  }}>
                    {item.totalOrders}
                  </div>
                  <div style={{ 
                    width: '100%', 
                    backgroundColor: 'var(--status-ready)', 
                    borderTopLeftRadius: '4px', 
                    borderTopRightRadius: '4px',
                    height: `${(item.totalOrders / maxOrders) * 100}%`,
                    minHeight: item.totalOrders > 0 ? '4px' : '0',
                    transition: 'height 1s ease-out',
                    marginTop: 'auto'
                  }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {item.hour.toString().padStart(2, '0')}:00
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
