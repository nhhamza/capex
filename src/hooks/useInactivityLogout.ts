import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseInactivityLogoutOptions {
  /**
   * Timeout in milliseconds before showing warning
   * Default: 9.5 minutes (9.5 * 60 * 1000)
   */
  inactivityTimeout?: number;

  /**
   * Warning duration in milliseconds
   * Default: 30 seconds (30 * 1000)
   */
  warningDuration?: number;

  /**
   * Callback when user should be logged out
   */
  onLogout: () => void | Promise<void>;

  /**
   * Callback to refresh token
   */
  onRefreshToken?: () => void | Promise<void>;

  /**
   * Whether the feature is enabled
   * Default: true
   */
  enabled?: boolean;
}

export interface UseInactivityLogoutReturn {
  /** Whether warning dialog should be shown */
  showWarning: boolean;
  /** Seconds remaining before auto-logout */
  secondsRemaining: number;
  /** User clicked "I'm still here" */
  handleStillHere: () => void;
  /** Close warning and logout */
  handleLogout: () => void;
}

/**
 * Hook to handle automatic logout after inactivity
 * Shows a warning dialog 30 seconds before logout
 *
 * @example
 * const { showWarning, secondsRemaining, handleStillHere, handleLogout } = useInactivityLogout({
 *   onLogout: async () => await auth.signOut(),
 *   onRefreshToken: async () => await auth.currentUser?.getIdToken(true),
 * });
 */
export function useInactivityLogout(options: UseInactivityLogoutOptions): UseInactivityLogoutReturn {
  const {
    inactivityTimeout = 9.5 * 60 * 1000, // 9.5 minutes
    warningDuration = 30 * 1000, // 30 seconds
    onLogout,
    onRefreshToken,
    enabled = true,
  } = options;

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start warning countdown
  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsRemaining(Math.floor(warningDuration / 1000));

    // Countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-logout after warning duration
    warningTimerRef.current = setTimeout(() => {
      clearAllTimers();
      onLogout();
    }, warningDuration);
  }, [warningDuration, onLogout, clearAllTimers]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    if (!enabled) return;

    // Start new inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, inactivityTimeout);
  }, [enabled, inactivityTimeout, startWarningCountdown, clearAllTimers]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (!showWarning) {
      resetInactivityTimer();
    }
  }, [showWarning, resetInactivityTimer]);

  // User clicked "I'm still here"
  const handleStillHere = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);

    // Refresh token if callback provided
    if (onRefreshToken) {
      try {
        await onRefreshToken();
      } catch (error) {
        console.error('[InactivityLogout] Failed to refresh token:', error);
      }
    }

    // Reset timers
    resetInactivityTimer();
  }, [clearAllTimers, onRefreshToken, resetInactivityTimer]);

  // Handle manual logout
  const handleLogout = useCallback(() => {
    clearAllTimers();
    onLogout();
  }, [clearAllTimers, onLogout]);

  // Setup activity listeners
  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [enabled, handleActivity, resetInactivityTimer, clearAllTimers]);

  return {
    showWarning,
    secondsRemaining,
    handleStillHere,
    handleLogout,
  };
}
