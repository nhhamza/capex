import { useState, useEffect, useRef } from 'react';

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
 */
export function useInactivityLogout(options: UseInactivityLogoutOptions): UseInactivityLogoutReturn {
  console.log('[InactivityLogout] *** HOOK FUNCTION CALLED ***', {
    inactivityTimeout: options.inactivityTimeout,
    warningDuration: options.warningDuration,
    enabled: options.enabled,
  });

  const {
    inactivityTimeout = 9.5 * 60 * 1000, // 9.5 minutes
    warningDuration = 30 * 1000, // 30 seconds
    onLogout,
    onRefreshToken,
    enabled = true,
  } = options;

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  // Use refs to store timer IDs
  const inactivityTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Track warning state in ref for activity handler
  const showWarningRef = useRef(false);

  // Use refs to store callbacks to avoid dependency issues
  const onLogoutRef = useRef(onLogout);
  const onRefreshTokenRef = useRef(onRefreshToken);

  // Update refs when callbacks change
  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    onRefreshTokenRef.current = onRefreshToken;
  }, [onRefreshToken]);

  // Keep showWarning ref in sync with state
  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Clear all timers - use ref for stable reference
  const clearAllTimers = useRef(() => {
    console.log('[InactivityLogout] Clearing all timers');
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current !== null) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  });

  // Start warning countdown - use ref for stable reference
  const startWarningCountdown = useRef(() => {
    console.log('[InactivityLogout] Starting warning countdown');
    showWarningRef.current = true;
    setShowWarning(true);
    setSecondsRemaining(Math.floor(warningDuration / 1000));

    // Countdown interval
    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        console.log('[InactivityLogout] Countdown:', next);
        return next <= 0 ? 0 : next;
      });
    }, 1000);

    // Auto-logout after warning duration
    warningTimerRef.current = window.setTimeout(() => {
      console.log('[InactivityLogout] Auto-logout triggered');
      clearAllTimers.current();
      if (onLogoutRef.current) {
        onLogoutRef.current();
      }
    }, warningDuration);
  });

  // Reset inactivity timer - use ref for stable reference
  const resetInactivityTimer = useRef(() => {
    console.log('[InactivityLogout] Resetting inactivity timer');
    clearAllTimers.current();
    showWarningRef.current = false;
    setShowWarning(false);

    if (!enabled) {
      console.log('[InactivityLogout] Disabled, not starting timer');
      return;
    }

    console.log(`[InactivityLogout] Starting inactivity timer for ${inactivityTimeout / 1000}s`);
    inactivityTimerRef.current = window.setTimeout(() => {
      console.log('[InactivityLogout] Inactivity timeout reached, showing warning');
      startWarningCountdown.current();
    }, inactivityTimeout);
  });

  // Update refs when options change
  useEffect(() => {
    console.log('[InactivityLogout] Options updated');
  }, [inactivityTimeout, warningDuration, enabled]);

  // Handle user activity - stable function using refs
  const handleActivity = useRef(() => {
    // Only reset if warning is not showing
    if (!showWarningRef.current) {
      console.log('[InactivityLogout] Activity detected, resetting timer');
      resetInactivityTimer.current();
    }
  });

  // User clicked "I'm still here"
  const handleStillHere = () => {
    console.log('[InactivityLogout] User clicked still here');
    clearAllTimers.current();
    showWarningRef.current = false;
    setShowWarning(false);

    // Refresh token if callback provided
    if (onRefreshTokenRef.current) {
      try {
        onRefreshTokenRef.current();
      } catch (error) {
        console.error('[InactivityLogout] Failed to refresh token:', error);
      }
    }

    // Reset timers
    resetInactivityTimer.current();
  };

  // Handle manual logout
  const handleLogout = () => {
    console.log('[InactivityLogout] Manual logout');
    clearAllTimers.current();
    if (onLogoutRef.current) {
      onLogoutRef.current();
    }
  };

  // Setup activity listeners - only runs once on mount
  useEffect(() => {
    console.log(`[InactivityLogout] *** USEEFFECT RUNNING - HOOK IS ACTIVE ***, enabled: ${enabled}`);

    if (!enabled) {
      console.log('[InactivityLogout] Feature disabled, cleaning up');
      clearAllTimers.current();
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

    console.log('[InactivityLogout] Adding activity listeners:', events);

    // Create a wrapper that calls the ref
    const activityHandler = () => {
      handleActivity.current();
    };

    // Add listeners
    events.forEach((event) => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    // Start initial timer
    console.log('[InactivityLogout] Starting initial timer');
    resetInactivityTimer.current();

    // Cleanup
    return () => {
      console.log('[InactivityLogout] Cleaning up - removing listeners and timers');
      events.forEach((event) => {
        document.removeEventListener(event, activityHandler);
      });
      clearAllTimers.current();
    };
  }, [enabled]); // Only re-run if enabled changes

  return {
    showWarning,
    secondsRemaining,
    handleStillHere,
    handleLogout,
  };
}
