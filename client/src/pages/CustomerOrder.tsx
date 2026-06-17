import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface CartItem {
  name: string;
  quantity: number;
  notes: string;
}

const MENU_ITEMS = [
  { name: 'Smash Burger',      emoji: '🍔', category: 'MAINS'    },
  { name: 'Truffle Fries',     emoji: '🍟', category: 'SIDES'    },
  { name: 'Caesar Salad',      emoji: '🥗', category: 'MAINS'    },
  { name: 'Grilled Chicken',   emoji: '🍗', category: 'MAINS'    },
  { name: 'Margherita Pizza',  emoji: '🍕', category: 'MAINS'    },
  { name: 'Onion Rings',       emoji: '🧅', category: 'SIDES'    },
  { name: 'Mushroom Soup',     emoji: '🍲', category: 'STARTERS' },
  { name: 'Garlic Bread',      emoji: '🥖', category: 'STARTERS' },
  { name: 'Mozzarella Sticks', emoji: '🧀', category: 'STARTERS' },
  { name: 'Chocolate Lava',    emoji: '🍫', category: 'DESSERTS' },
  { name: 'Vanilla Sundae',    emoji: '🍨', category: 'DESSERTS' },
  { name: 'Lemonade',          emoji: '🍋', category: 'DRINKS'   },
  { name: 'Cold Brew',         emoji: '☕', category: 'DRINKS'   },
  { name: 'Mango Lassi',       emoji: '🥭', category: 'DRINKS'   },
];

const CATEGORIES = ['ALL', 'MAINS', 'STARTERS', 'SIDES', 'DESSERTS', 'DRINKS'];

const inp: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  backgroundColor: '#0d0d0d',
  border: '1px solid #2a2a2a',
  color: '#e8e6e0',
  borderRadius: '4px',
  fontFamily: "'Fira Code', monospace",
  fontSize: '0.85rem',
  outline: 'none',
};

export const CustomerOrder: React.FC = () => {
  const [tableNumber, setTableNumber] = useState('');
  const [phone, setPhone]             = useState('');
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [noteTarget, setNoteTarget]   = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flash, setFlash]             = useState<{ msg: string; ok: boolean } | null>(null);

  const addToCart = (name: string) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.name === name);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { name, quantity: 1, notes: '' }];
    });
  };

  const changeQty = (idx: number, delta: number) => {
    setCart(prev => {
      const next = [...prev];
      const q = next[idx].quantity + delta;
      if (q <= 0) return next.filter((_, i) => i !== idx);
      next[idx] = { ...next[idx], quantity: q };
      return next;
    });
  };

  const setNote = (idx: number, notes: string) => {
    setCart(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], notes };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!tableNumber || cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: parseInt(tableNumber, 10),
          phone: phone || undefined,
          items: cart,
        }),
      });
      if (!res.ok) throw new Error();
      setFlash({ msg: `ORDER FIRED → TABLE ${tableNumber}`, ok: true });
      setCart([]);
      setTableNumber('');
      setPhone('');
    } catch {
      setFlash({ msg: 'SUBMISSION FAILED. CHECK CONNECTION.', ok: false });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setFlash(null), 4000);
    }
  };

  const filtered = activeCategory === 'ALL'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(m => m.category === activeCategory);

  const total = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d0d0d', color: '#e8e6e0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ padding: '0.85rem 2rem', borderBottom: '1px solid #2a2a2a', backgroundColor: '#141414', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Fira Code', monospace", letterSpacing: '0.08em' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>[ POS ] </span>
          <span style={{ fontSize: '0.85rem', color: '#6b6966' }}>ORDER ENTRY TERMINAL</span>
        </div>
        <a href="/" style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.8rem', color: '#6b6966', textDecoration: 'none' }}>← KITCHEN DISPLAY</a>
      </header>

      {/* Flash Banner */}
      {flash && (
        <div style={{
          padding: '0.75rem 2rem',
          backgroundColor: flash.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          borderBottom: `1px solid ${flash.ok ? '#22c55e' : '#ef4444'}`,
          fontFamily: "'Fira Code', monospace",
          fontSize: '0.85rem',
          color: flash.ok ? '#22c55e' : '#ef4444',
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}>
          {flash.ok ? '✔' : '✘'} {flash.msg}
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>

        {/* LEFT: Menu Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2a2a', overflow: 'hidden' }}>

          {/* Category Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: '0.65rem 1.15rem',
                fontFamily: "'Fira Code', monospace",
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                border: 'none',
                borderBottom: activeCategory === cat ? '2px solid #f59e0b' : '2px solid transparent',
                backgroundColor: activeCategory === cat ? '#1c1c1c' : 'transparent',
                color: activeCategory === cat ? '#f59e0b' : '#6b6966',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', alignContent: 'start' }}>
            {filtered.map(item => {
              const inCart = cart.find(c => c.name === item.name);
              return (
                <button key={item.name} onClick={() => addToCart(item.name)} style={{
                  backgroundColor: inCart ? 'rgba(245,158,11,0.1)' : '#141414',
                  border: inCart ? '1px solid #f59e0b' : '1px solid #2a2a2a',
                  borderRadius: '6px',
                  padding: '1rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 120ms',
                  position: 'relative',
                }}>
                  {inCart && (
                    <span style={{ position: 'absolute', top: '6px', right: '8px', fontFamily: "'Fira Code', monospace", fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>
                      ×{inCart.quantity}
                    </span>
                  )}
                  <span style={{ fontSize: '1.75rem' }}>{item.emoji}</span>
                  <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.68rem', color: inCart ? '#f59e0b' : '#e8e6e0', textAlign: 'center', lineHeight: 1.3 }}>
                    {item.name.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Order Summary Panel */}
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>

          {/* Table + Phone Inputs */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
            <div>
              <label style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.68rem', color: '#6b6966', display: 'block', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>TABLE NUMBER *</label>
              <input type="number" min="1" placeholder="e.g. 12" value={tableNumber} onChange={e => setTableNumber(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.68rem', color: '#6b6966', display: 'block', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>PHONE (SMS ALERT)</label>
              <input type="tel" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Cart */}
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#3d3d3a', fontFamily: "'Fira Code', monospace", fontSize: '0.78rem', marginTop: '2.5rem', lineHeight: 2 }}>
                [ NO ITEMS SELECTED ]<br />Tap menu tiles to add
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '0.65rem 0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.76rem', fontWeight: 600 }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button onClick={() => changeQty(idx, -1)} style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid #2a2a2a', backgroundColor: '#1c1c1c', color: '#e8e6e0', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.85rem', minWidth: '18px', textAlign: 'center', color: '#f59e0b' }}>{item.quantity}</span>
                    <button onClick={() => changeQty(idx, +1)} style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid #2a2a2a', backgroundColor: '#1c1c1c', color: '#e8e6e0', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
                {noteTarget === idx ? (
                  <input autoFocus type="text" placeholder="Allergy / mod note..." value={item.notes} onChange={e => setNote(idx, e.target.value)} onBlur={() => setNoteTarget(null)} style={{ ...inp, marginTop: '0.4rem', fontSize: '0.73rem' }} />
                ) : (
                  <div onClick={() => setNoteTarget(idx)} style={{ marginTop: '0.35rem', fontFamily: "'Fira Code', monospace", fontSize: '0.7rem', color: item.notes ? '#f59e0b' : '#3d3d3a', cursor: 'pointer' }}>
                    {item.notes || '+ add allergy / mod note'}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Fire Button */}
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #2a2a2a', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.72rem', color: '#6b6966', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>ITEMS IN ORDER</span>
              <span style={{ color: '#e8e6e0' }}>{total} item{total !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !tableNumber || cart.length === 0}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: (isSubmitting || !tableNumber || cart.length === 0) ? '#1c1c1c' : '#ef4444',
                color:           (isSubmitting || !tableNumber || cart.length === 0) ? '#3d3d3a' : '#fff',
                border: 'none',
                borderRadius: '6px',
                fontFamily: "'Fira Code', monospace",
                fontSize: '0.88rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: (isSubmitting || !tableNumber || cart.length === 0) ? 'not-allowed' : 'pointer',
                transition: 'all 150ms',
              }}
            >
              {isSubmitting ? '[ FIRING... ]' : '[ FIRE ORDER → KITCHEN ]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
