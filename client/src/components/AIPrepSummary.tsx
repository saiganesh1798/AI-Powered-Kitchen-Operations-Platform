import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const AIPrepSummary: React.FC = () => {
  const [summary, setSummary] = useState<string>('INITIALIZING AI PIPELINE...');

  useEffect(() => {
    let isMounted = true;
    
    const fetchSummary = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/analytics/prep-summary`);
        if (!res.ok) throw new Error('Network response was not ok');
        const text = await res.text();
        if (isMounted) setSummary(text);
      } catch (err) {
        if (isMounted) setSummary('AI SERVICE UNREACHABLE.');
      }
    };

    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const renderHighlighted = (text: string) => {
    // Split text by ALLERGY, WARNING, CRITICAL, NO ACTIVE ORDERS
    const regex = /(ALLERGY|WARNING|CRITICAL|NO ACTIVE ORDERS\. KITCHEN IS CLEAR\.)/gi;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      if (/^(ALLERGY|WARNING|CRITICAL)$/i.test(part)) {
        return <span key={i} style={{ color: 'var(--status-amber)', fontWeight: 'bold' }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--bg-surface)',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-primary)',
      padding: '0.75rem 1rem',
      fontSize: '0.85rem',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        [ AI PREP AGGREGATION ]
      </div>
      <div>
        {renderHighlighted(summary)}
      </div>
    </div>
  );
};
