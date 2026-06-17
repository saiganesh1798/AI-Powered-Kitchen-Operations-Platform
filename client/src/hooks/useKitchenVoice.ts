import { useState, useRef, useEffect, useCallback } from 'react';

export interface KitchenVoiceHook {
  /** Whether the voice system is switched ON by the user */
  isActive: boolean;
  /** True while the microphone hardware is actively capturing audio */
  isListening: boolean;
  /** Last finalised transcript string from the speech engine */
  transcript: string;
  /** Clears the transcript buffer */
  resetTranscript: () => void;
  /** Toggle voice ON / OFF */
  toggleActive: () => void;
  /** False if the browser doesn't support Web Speech API */
  isSupported: boolean;
  /** Last error description, empty string when clean */
  errorMessage: string;
}

/**
 * Manages a continuous push-to-toggle voice capture loop.
 *
 * When `isActive` is true the hook runs a non-continuous single-phrase
 * recognition session and automatically restarts it after each result or
 * silence timeout — producing a seamless "always listening" effect while
 * the toggle is ON.
 *
 * Command parsing + socket emitting are handled by VoiceCommandConsole.
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

  // Ref mirror of isActive so onend callback always sees the current value
  const isActiveRef = useRef(false);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setErrorMessage('');
  }, []);

  // ── Recognition loop ─────────────────────────────────────────────────────
  // Runs whenever isActive flips. Cleanup shuts the session down on toggle-off.
  useEffect(() => {
    if (!isActive || !isSupported) return;

    let mounted = true;
    let rec: any = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (!mounted) return;

      rec = new SpeechRecognition();
      rec.continuous      = false;   // single-phrase per session
      rec.interimResults  = false;   // finals only
      rec.lang            = 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        if (mounted) { setIsListening(true); setErrorMessage(''); }
      };

      rec.onresult = (event: any) => {
        if (!mounted) return;
        const raw: string = event.results[0][0].transcript;
        const cleaned = raw
          .toLowerCase()
          .trim()
          .replace(/[.,!?]/g, '')
          .replace(/\s+/g, ' ');
        setTranscript(cleaned);
      };

      rec.onerror = (event: any) => {
        if (!mounted) return;
        setIsListening(false);
        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            // Hard stop — user denied mic, don't loop
            isActiveRef.current = false;
            setIsActive(false);
            setErrorMessage('Microphone permission denied. Allow mic in browser settings.');
            break;
          case 'audio-capture':
            isActiveRef.current = false;
            setIsActive(false);
            setErrorMessage('No microphone detected. Check device audio input.');
            break;
          case 'no-speech':
          case 'aborted':
            // Normal — silence timeout or programmatic stop; loop handles restart
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
        rec = null;
        // Auto-restart after a short breath so the browser doesn't choke
        if (mounted && isActiveRef.current) {
          restartTimer = setTimeout(start, 350);
        }
      };

      try {
        rec.start();
      } catch (err) {
        setErrorMessage(`Failed to start recognition: ${err}`);
      }
    };

    start();

    return () => {
      mounted = false;
      if (restartTimer) clearTimeout(restartTimer);
      if (rec) { try { rec.stop(); } catch (_) { /* already stopped */ } }
      setIsListening(false);
    };
  // isActive is the only meaningful dep — SpeechRecognition is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isSupported]);

  const toggleActive = useCallback(() => {
    setIsActive(prev => {
      const next = !prev;
      isActiveRef.current = next;
      if (!next) {
        // Clear any stale transcript when toggling off
        setTranscript('');
        setErrorMessage('');
      }
      return next;
    });
  }, []);

  return {
    isActive,
    isListening,
    transcript,
    resetTranscript,
    toggleActive,
    isSupported,
    errorMessage,
  };
}
