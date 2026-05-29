import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function useAntiCheat({ sessionId, studentId, onWarning, onLockout, active }) {
  const violationCount = useRef(0);
  const lastLogged = useRef(0);

  // Prevent double-logging rapid duplicate blurs
  const logViolation = async (eventType) => {
    if (!active) return;
    const now = Date.now();
    if (now - lastLogged.current < 2000) return; // 2s throttle
    lastLogged.current = now;

    console.warn(`[AntiCheat] Violation detected: ${eventType}`);
    violationCount.current += 1;

    // Log to DB
    try {
      if (sessionId && studentId) {
        await supabase.from('cheat_logs').insert({
          session_id: sessionId,
          student_id: studentId,
          event_type: eventType
        });
      }
    } catch (e) {
      console.error('[AntiCheat] Failed to write cheat log to DB:', e);
    }

    if (violationCount.current >= 2) {
      if (onLockout) onLockout(eventType);
    } else {
      if (onWarning) onWarning(violationCount.current, eventType);
    }
  };

  useEffect(() => {
    if (!active) {
      violationCount.current = 0;
      return;
    }

    // 1. Right Click Blocker
    const handleContextMenu = (e) => {
      e.preventDefault();
      logViolation('right_click');
    };

    // 2. Keyboard Copy/Print Blocker
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Ctrl+C, Ctrl+A, Ctrl+S, Ctrl+P, Ctrl+Shift+S, Meta+Shift+S
      if (isCtrl && (key === 'c' || key === 'a' || key === 's' || key === 'p' || key === 'i' || key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        logViolation(`shortcut_${key}`);
        return false;
      }

      // Block PrintScreen key
      if (e.key === 'PrintScreen' || key === 'printscreen') {
        e.preventDefault();
        e.stopPropagation();
        logViolation('print_screen');
        return false;
      }
    };

    // 3. Tab Switch/Focus loss blocker
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch');
      }
    };

    const handleWindowBlur = () => {
      logViolation('window_blur');
    };

    // Apply listeners
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    // Add class helper to body
    document.body.classList.add('exam-view');

    return () => {
      // Clean up listeners
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.body.classList.remove('exam-view');
    };
  }, [active, sessionId, studentId]);

  return {
    getViolationCount: () => violationCount.current,
    resetViolations: () => {
      violationCount.current = 0;
    }
  };
}
