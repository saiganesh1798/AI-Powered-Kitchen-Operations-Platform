import { useEffect } from 'react';

interface UseBumpBarOptions {
  onSelectOldest: () => void;
  onTriggerAction: () => void;
  onArchive: () => void;
  isActive: boolean;
}

export const useBumpBar = ({ onSelectOldest, onTriggerAction, onArchive, isActive }: UseBumpBarOptions) => {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keydowns when typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          e.preventDefault();
          onSelectOldest();
          break;
        case 'Enter':
          e.preventDefault();
          onTriggerAction();
          break;
        case ' ': // Spacebar
          e.preventDefault();
          onArchive();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectOldest, onTriggerAction, onArchive, isActive]);
};
