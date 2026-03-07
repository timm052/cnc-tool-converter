import { useEffect, useRef } from 'react';

export interface ShortcutDef {
  key:      string;
  ctrl?:    boolean;
  shift?:   boolean;
  /** If true, fires even when an input/textarea is focused */
  allowInInput?: boolean;
  callback: () => void;
}

/**
 * Registers global keyboard shortcuts.
 * Uses a ref for the shortcuts array so listeners aren't re-registered on every render.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[], active = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!active) return;

    function handleKey(e: KeyboardEvent) {
      const target    = e.target as HTMLElement;
      const inInput   = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const ctrlHeld  = e.ctrlKey || e.metaKey;

      for (const s of shortcutsRef.current) {
        const ctrlMatch  = s.ctrl  ? ctrlHeld    : !ctrlHeld;
        const shiftMatch = s.shift ? e.shiftKey  : !e.shiftKey;

        if (e.key === s.key && ctrlMatch && shiftMatch) {
          if (inInput && !s.allowInInput) continue;
          e.preventDefault();
          s.callback();
          return;
        }
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [active]);
}
