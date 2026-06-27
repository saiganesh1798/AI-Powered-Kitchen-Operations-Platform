import { useState, useRef, useEffect, useCallback } from 'react';

export interface KitchenVoiceHook {
  isActive: boolean;
  isListening: boolean;
  transcript: string;
  resetTranscript: () => void;
  toggleActive: () => void;
  isSupported: boolean;
  errorMessage: string;
}

/**
 * Continuous voice capture using a single persistent recognition session.
 *
 * Key design decisions for low latency and high accuracy:
 *  - continuous: true  → one session runs forever; no restart gaps between phrases
 *  - interimResults: true → transcripts fire while you're still speaking
 *  - normalizeSpokenNumbers() → converts word numbers like "five" -> "5" instantly
 *  - Synonym expansion in looksLikeCommand() → matches "cook table 5" or "finish table 5" instantly
 */
export function useKitchenVoice(): KitchenVoiceHook {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = Boolean(SpeechRecognition);

  const [isActive, setIsActive]         = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isActiveRef = useRef(false);
  const recRef      = useRef<any>(null);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setErrorMessage('');
  }, []);

  // ── Single persistent recognition session ──────────────────────────────────
  useEffect(() => {
    if (!isActive || !isSupported) return;

    let mounted = true;

    const rec = new SpeechRecognition();
    recRef.current = rec;

    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (mounted) { setIsListening(true); setErrorMessage(''); }
    };

    rec.onresult = (event: any) => {
      if (!mounted) return;

      // Walk all new results from the last processed index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result  = event.results[i];
        const raw: string = result[0].transcript;
        
        const cleaned = raw
          .toLowerCase()
          .trim()
          .replace(/[.,!?]/g, '')
          .replace(/\s+/g, ' ');

        // Convert spoken word numbers (e.g. "five" -> "5")
        const normalized = normalizeSpokenNumbers(cleaned);

        if (result.isFinal) {
          setTranscript(normalized);
        } else {
          // Interim check: if it looks like a complete command, fire it immediately
          if (looksLikeCommand(normalized)) {
            setTranscript(normalized);
          }
        }
      }
    };

    rec.onerror = (event: any) => {
      if (!mounted) return;
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          isActiveRef.current = false;
          setIsActive(false);
          setIsListening(false);
          setErrorMessage('Microphone permission denied. Allow mic in browser settings.');
          break;
        case 'audio-capture':
          isActiveRef.current = false;
          setIsActive(false);
          setIsListening(false);
          setErrorMessage('No microphone detected. Check device audio input.');
          break;
        case 'no-speech':
          if (mounted && isActiveRef.current) {
            try { rec.stop(); } catch (_) {}
            setTimeout(() => {
              if (mounted && isActiveRef.current) {
                try { rec.start(); } catch (_) {}
              }
            }, 100);
          }
          break;
        case 'aborted':
          break;
        case 'network':
          setErrorMessage('Network error. Retrying…');
          break;
        default:
          setErrorMessage(`Speech error: ${event.error}`);
      }
    };

    rec.onend = () => {
      if (!mounted) return;
      setIsListening(false);
      if (mounted && isActiveRef.current) {
        setTimeout(() => {
          if (mounted && isActiveRef.current) {
            try { rec.start(); setIsListening(true); } catch (_) {}
          }
        }, 80);
      }
    };

    try {
      rec.start();
    } catch (err) {
      setErrorMessage(`Failed to start recognition: ${err}`);
    }

    return () => {
      mounted = false;
      isActiveRef.current = false;
      setIsListening(false);
      try { rec.stop(); } catch (_) {}
      recRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isSupported]);

  const toggleActive = useCallback(() => {
    setIsActive(prev => {
      const next = !prev;
      isActiveRef.current = next;
      if (!next) {
        setTranscript('');
        setErrorMessage('');
        try { recRef.current?.stop(); } catch (_) {}
      }
      return next;
    });
  }, []);

  return { isActive, isListening, transcript, resetTranscript, toggleActive, isSupported, errorMessage };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

/** Normalizes spoken word numbers in a transcript sentence to digits. */
export function normalizeSpokenNumbers(text: string): string {
  return text.split(/\s+/).map(word => {
    return NUM_WORDS[word] !== undefined ? String(NUM_WORDS[word]) : word;
  }).join(' ');
}

/**
 * Returns true if the interim transcript already matches a known command shape.
 * Leverages synonyms to maximize quick-matching accuracy.
 */
function looksLikeCommand(t: string): boolean {
  return (
    /^(?:chef\s+)?(?:start\s+order|start\s+table|cook\s+table|prepare\s+table|begin\s+table|start\s+cooking)\s+[\w\d]+/.test(t) ||
    /^(?:chef\s+)?(?:ready\s+table|finish\s+table|mark\s+ready|ready\s+order|completed\s+table|done\s+table)\s+(?:number\s+)?\d+/.test(t) ||
    /^(?:chef\s+)?(?:clear\s+table|serve\s+table|archive\s+table|bump\s+table|clear\s+order)\s+(?:number\s+)?\d+/.test(t)
  );
}
