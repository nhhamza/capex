import { useState, useCallback, useRef, useEffect } from 'react';
import { useIdleTimer } from 'react-idle-timer';

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
 * Shows a warning dialog before logout
 * Uses react-idle-timer library for reliable idle detection
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
  const countdownIntervalRef = useRef<number | null>(null);

  // Store callbacks in refs to avoid recreating them
  const onLogoutRef = useRef(onLogout);
  const onRefreshTokenRef = useRef(onRefreshToken);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    onRefreshTokenRef.current = onRefreshToken;
  }, [onRefreshToken]);

  // Clear countdown interval
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start countdown when warning is shown
  const startCountdown = useCallback(() => {
    console.log('[InactivityLogout] Starting warning countdown');
    setSecondsRemaining(Math.floor(warningDuration / 1000));

    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        console.log('[InactivityLogout] Countdown:', next);
        if (next <= 0) {
          clearCountdown();
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [warningDuration, clearCountdown]);

  // Handle when prompt should be shown (warning phase)
  const handleOnPrompt = useCallback(() => {
    console.log('[InactivityLogout] Prompt triggered - showing warning');
    setShowWarning(true);
    startCountdown();
  }, [startCountdown]);

  // Handle when user becomes idle (auto logout)
  const handleOnIdle = useCallback(() => {
    console.log('[InactivityLogout] User is idle - logging out');
    clearCountdown();
    setShowWarning(false);
    if (onLogoutRef.current) {
      onLogoutRef.current();
    }
  }, [clearCountdown]);

  // Handle when user becomes active again
  const handleOnActive = useCallback(() => {
    console.log('[InactivityLogout] User is active');
    clearCountdown();
    setShowWarning(false);
  }, [clearCountdown]);

  // Initialize idle timer
  const { reset, pause, resume } = useIdleTimer({
    timeout: inactivityTimeout + warningDuration, // Total time before logout
    promptBeforeIdle: warningDuration, // Show warning this many ms before timeout
    onPrompt: handleOnPrompt,
    onIdle: handleOnIdle,
    onActive: handleOnActive,
    disabled: !enabled,
    throttle: 500, // Throttle activity events to avoid performance issues
    events: [
      'mousedown',
      'keypress',
      'touchstart',
      'click',
    ],
  });

  useEffect(() => {
    console.log('[InactivityLogout] Hook initialized with react-idle-timer', {
      enabled,
      timeout: inactivityTimeout + warningDuration,
      promptBeforeIdle: warningDuration,
    });

    if (!enabled) {
      pause();
    } else {
      resume();
    }
  }, [enabled, inactivityTimeout, warningDuration, pause, resume]);

  // User clicked "I'm still here"
  const handleStillHere = useCallback(async () => {
    console.log('[InactivityLogout] User clicked still here');
    clearCountdown();
    setShowWarning(false);

    // Refresh token if callback provided
    if (onRefreshTokenRef.current) {
      try {
        await onRefreshTokenRef.current();
      } catch (error) {
        console.error('[InactivityLogout] Failed to refresh token:', error);
      }
    }

    // Reset the idle timer
    reset();
  }, [clearCountdown, reset]);

  // Handle manual logout
  const handleLogout = useCallback(() => {
    console.log('[InactivityLogout] Manual logout');
    clearCountdown();
    if (onLogoutRef.current) {
      onLogoutRef.current();
    }
  }, [clearCountdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[InactivityLogout] Cleaning up');
      clearCountdown();
    };
  }, [clearCountdown]);

  return {
    showWarning,
    secondsRemaining,
    handleStillHere,
    handleLogout,
  };
}
