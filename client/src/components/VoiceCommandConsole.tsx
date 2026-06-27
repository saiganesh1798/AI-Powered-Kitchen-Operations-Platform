import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Terminal, ChevronRight, RotateCcw, Power } from 'lucide-react';
import { useKitchenVoice } from '../hooks/useKitchenVoice';
import type { Order, OrderStatus } from '../../../shared/types';

interface Props {
  orders: Order[];
  updateStatus: (orderId: string, status: OrderStatus) => void;
  isConnected: boolean;
}

interface CommandResult {
  ok: boolean;
  message: string;
}

/** Parses a normalised transcript string and fires the appropriate updateStatus call. */
function parseAndExecute(
  raw: string,
  orders: Order[],
  updateStatus: (id: string, s: OrderStatus) => void,
): CommandResult {
  // 1. Basic cleaning and spacing
  const cleaned = raw.toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();
  
  // 2. Convert spoken words to digits (e.g. "ready table five" -> "ready table 5")
  const t = normalizeSpokenNumbers(cleaned);

  /**
   * Unified order resolver for a raw token `[X]`.
   * Priority:
   *  1. Exact _id match
   *  2. _id suffix match (handles partial spoken IDs)
   *  3. tableNumber match — "start order 11" → table 11
   */
  const resolveOrder = (
    token: string,
    statusFilter?: Order['status'],
  ): Order | undefined => {
    const inputClean = token.trim().toLowerCase();
    const pool = statusFilter ? orders.filter(o => o.status === statusFilter) : orders;
    return pool.find(o => {
      if (o._id.toLowerCase() === inputClean) return true;
      if (o._id.toLowerCase().endsWith(inputClean)) return true;
      if (o.tableNumber.toString() === inputClean) return true;
      return false;
    });
  };

  // ── 1. START COOKING SYNONYMS ──────────────────────────────────────────────
  // Supported: "start order 5", "start table 5", "cook table 5", "prepare table 5", "begin table 5", "start cooking 5"
  const startMatch = t.match(/^(?:chef\s+)?(?:start\s+order|start\s+table|cook\s+table|prepare\s+table|begin\s+table|start\s+cooking)\s+([\w\d\s]+)$/);
  if (startMatch) {
    const token = startMatch[1].replace(/\s+/g, '');
    const order = resolveOrder(token, 'received');
    if (!order) {
      const anyMatch = resolveOrder(token);
      if (anyMatch)
        return { ok: false, message: `✗ Order already ${anyMatch.status.toUpperCase()}` };
      return { ok: false, message: `✗ No received order matching "${token}"` };
    }
    updateStatus(order._id, 'cooking');
    return { ok: true, message: `✓ Order …${order._id.slice(-6)} / T${order.tableNumber} → COOKING` };
  }

  // ── 2. MARK READY SYNONYMS ────────────────────────────────────────────────
  // Supported: "ready table 5", "finish table 5", "mark ready 5", "ready order 5", "completed table 5", "done table 5"
  const readyMatch = t.match(/^(?:chef\s+)?(?:ready\s+table|finish\s+table|mark\s+ready|ready\s+order|completed\s+table|done\s+table)\s+(?:number\s+)?([\w\d]+)$/);
  if (readyMatch) {
    const token = readyMatch[1];
    const order = resolveOrder(token, 'cooking');
    if (!order) return { ok: false, message: `✗ No cooking order at table ${token}` };
    updateStatus(order._id, 'ready');
    return { ok: true, message: `✓ Table ${token} → READY` };
  }

  // ── 3. SERVE & ARCHIVE SYNONYMS ────────────────────────────────────────────
  // Supported: "clear table 5", "serve table 5", "archive table 5", "bump table 5", "clear order 5"
  const clearMatch = t.match(/^(?:chef\s+)?(?:clear\s+table|serve\s+table|archive\s+table|bump\s+table|clear\s+order)\s+(?:number\s+)?([\w\d]+)$/);
  if (clearMatch) {
    const token = clearMatch[1];
    const order = resolveOrder(token, 'ready');
    if (!order) return { ok: false, message: `✗ No ready order at table ${token}` };
    updateStatus(order._id, 'served');
    return { ok: true, message: `✓ Table ${token} → SERVED` };
  }

  return {
    ok: false,
    message: `✗ Unknown command. Try: "cook table <n>", "ready table <n>", "serve table <n>"`,
  };
}

// Spoken number normalizer maps
const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

function normalizeSpokenNumbers(text: string): string {
  return text.split(/\s+/).map(word => {
    return NUM_WORDS[word] !== undefined ? String(NUM_WORDS[word]) : word;
  }).join(' ');
}

export const VoiceCommandConsole: React.FC<Props> = ({ orders, updateStatus, isConnected }) => {
  const {
    isActive,
    isListening,
    transcript,
    resetTranscript,
    toggleActive,
    isSupported,
    errorMessage,
  } = useKitchenVoice();

  const [inputValue, setInputValue] = useState('');
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep latest orders + updateStatus in refs so the auto-submit timer
  // always works against the freshest state without re-running the effect.
  const ordersRef       = useRef(orders);
  const updateStatusRef = useRef(updateStatus);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { updateStatusRef.current = updateStatus; }, [updateStatus]);

  // ── Auto-execute when a transcript arrives ──────────────────────────────
  useEffect(() => {
    if (!transcript) return;

    setInputValue(transcript);
    setLastResult(null);

    if (isActive) {
      // Execute immediately — no countdown delay.
      // The hook already fires only on final results or matched interim patterns,
      // so we trust the transcript is complete enough to act on.
      const result = parseAndExecute(transcript, ordersRef.current, updateStatusRef.current);
      setLastResult(result);
      if (result.ok) {
        setInputValue('');
        resetTranscript();
      }
      // If no match: leave it in the input field so the chef can correct + hit Enter
    } else {
      // Manual mode — just focus the field
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);


  // ── Manual submit ────────────────────────────────────────────────────────
  const handleRun = useCallback(() => {
    const raw = inputValue.trim();
    if (!raw) return;
    const result = parseAndExecute(raw, ordersRef.current, updateStatusRef.current);
    setLastResult(result);
    if (result.ok) {
      setInputValue('');
      resetTranscript();
    }
  }, [inputValue, resetTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleRun(); }
    if (e.key === 'Escape') { setInputValue(''); resetTranscript(); setLastResult(null); }
  };

  const handleReset = () => {
    setInputValue('');
    resetTranscript();
    setLastResult(null);
  };

  const handleToggle = () => {
    if (!isConnected || !isSupported) return;
    setLastResult(null);
    setInputValue('');
    resetTranscript();
    toggleActive();
  };

  // ── Derived display ──────────────────────────────────────────────────────
  const cannotUseVoice = !isSupported || !isConnected;

  // Toggle button label + colour
  const toggleLabel = isListening
    ? '[ ● LISTENING… ]'
    : isActive
    ? '[ ● VOICE ON ]'
    : '[ ○ VOICE OFF ]';

  const toggleColor = isListening
    ? 'var(--status-amber)'
    : isActive
    ? 'var(--status-ready)'
    : 'var(--text-muted)';

  const toggleBg = isListening
    ? 'rgba(251,191,36,0.08)'
    : isActive
    ? 'rgba(34,197,94,0.06)'
    : 'transparent';

  const toggleBorder = isListening
    ? 'var(--status-amber)'
    : isActive
    ? 'var(--status-ready)'
    : 'var(--border)';

  const statusColor = lastResult
    ? lastResult.ok ? 'var(--status-ready)' : 'var(--status-crimson)'
    : errorMessage
    ? 'var(--status-crimson)'
    : 'var(--text-muted)';

  const statusText = lastResult?.message
    ?? (errorMessage || '');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.45rem 0.75rem',
        backgroundColor: 'var(--bg-elevated)',
        border: `1px solid ${isActive ? toggleBorder : 'var(--border)'}`,
        borderRadius: '4px',
        fontFamily: 'var(--font-mono)',
        transition: 'border-color 200ms',
      }}
    >
      {/* ── ON / OFF Toggle ─────────────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        disabled={cannotUseVoice}
        title={
          !isSupported
            ? 'Web Speech API not supported — use Chrome or Edge'
            : !isConnected
            ? 'Server disconnected'
            : isActive
            ? 'Click to turn voice OFF'
            : 'Click to turn voice ON (auto-listens continuously)'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.65rem',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.07em',
          border: `1px solid ${toggleBorder}`,
          borderRadius: '3px',
          backgroundColor: toggleBg,
          color: cannotUseVoice ? 'var(--text-dim)' : toggleColor,
          cursor: cannotUseVoice ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 200ms',
          boxShadow: isListening ? '0 0 10px rgba(251,191,36,0.3)' : 'none',
          animation: isListening ? 'pulseAmber 1.5s infinite' : 'none',
          flexShrink: 0,
        }}
      >
        {cannotUseVoice ? (
          <MicOff size={12} />
        ) : isListening || isActive ? (
          <Mic size={12} />
        ) : (
          <Power size={12} />
        )}
        {cannotUseVoice ? '[ NO MIC ]' : toggleLabel}
      </button>

      {/* ── Editable transcript / command input ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
        <Terminal size={11} color="var(--text-dim)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setLastResult(null); }}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'capturing speech…'
              : isActive
              ? 'waiting for speech…'
              : 'type or toggle voice to speak…'
          }
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            caretColor: 'var(--status-amber)',
          }}
        />


        {/* Clear button */}
        {inputValue && (
          <button
            onClick={handleReset}
            title="Clear (Esc)"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 0,
              display: 'flex',
              flexShrink: 0,
            }}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      {/* ── Run Command button ───────────────────────────────────────────── */}
      <button
        onClick={handleRun}
        disabled={!inputValue.trim()}
        title="Execute command (Enter)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.3rem 0.65rem',
          fontSize: '0.65rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.07em',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          backgroundColor: inputValue.trim() ? 'rgba(34,197,94,0.08)' : 'transparent',
          color: inputValue.trim() ? 'var(--status-ready)' : 'var(--text-dim)',
          cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
          whiteSpace: 'nowrap',
          transition: 'all 150ms',
          flexShrink: 0,
        }}
      >
        RUN
        <ChevronRight size={11} />
      </button>

      {/* ── Status / result line ────────────────────────────────────────── */}
      {statusText && (
        <span
          style={{
            fontSize: '0.62rem',
            fontFamily: 'var(--font-mono)',
            color: statusColor,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            maxWidth: '260px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={statusText}
        >
          {statusText}
        </span>
      )}
    </div>
  );
};
