'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { DATASET_START, DATASET_END } from '@/lib/data/scenarios';
import type { PlaybackSpeed } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaybackState {
  currentTime: Date;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  selectedIncidentId: string | null;
  selectedSignalId: string | null;
  activeView: 'pulse' | 'radar' | 'investigation' | 'what-changed';
}

interface PlaybackContextValue extends PlaybackState {
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  scrubTo: (time: Date) => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  selectIncident: (id: string | null) => void;
  selectSignal: (id: string | null) => void;
  setActiveView: (view: PlaybackState['activeView']) => void;
  datasetStart: Date;
  datasetEnd: Date;
  progress: number; // 0 to 1
  currentTimeISO: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DS_START = new Date(DATASET_START);
const DS_END = new Date(DATASET_END);
const DS_RANGE_MS = DS_END.getTime() - DS_START.getTime();

// Start the demo at 14:20 UTC (just before the APAC incident) for immediate impact
const INITIAL_TIME = new Date('2024-01-15T14:20:00Z');

/** Tick interval in real milliseconds */
const TICK_INTERVAL_MS = 1000;

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlaybackState>({
    currentTime: INITIAL_TIME,
    isPlaying: false,
    speed: 1,
    selectedIncidentId: null,
    selectedSignalId: null,
    activeView: 'pulse',
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Tick handler — advances simulated time
  useEffect(() => {
    if (state.isPlaying) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          const advanceMs = prev.speed * 60 * 1000; // Each tick = speed × 1 minute
          const nextMs = Math.min(
            prev.currentTime.getTime() + advanceMs,
            DS_END.getTime()
          );

          if (nextMs >= DS_END.getTime()) {
            return { ...prev, currentTime: DS_END, isPlaying: false };
          }

          return { ...prev, currentTime: new Date(nextMs) };
        });
      }, TICK_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isPlaying, state.speed]);

  // Actions
  const play = useCallback(() => setState((s) => ({ ...s, isPlaying: true })), []);
  const pause = useCallback(() => setState((s) => ({ ...s, isPlaying: false })), []);
  const togglePlayback = useCallback(
    () => setState((s) => ({ ...s, isPlaying: !s.isPlaying })),
    []
  );

  const setSpeed = useCallback(
    (speed: PlaybackSpeed) => setState((s) => ({ ...s, speed })),
    []
  );

  const scrubTo = useCallback((time: Date) => {
    const clamped = new Date(
      Math.max(DS_START.getTime(), Math.min(time.getTime(), DS_END.getTime()))
    );
    setState((s) => ({ ...s, currentTime: clamped }));
  }, []);

  const stepForward = useCallback(() => {
    setState((s) => {
      const nextMs = Math.min(
        s.currentTime.getTime() + 60 * 1000,
        DS_END.getTime()
      );
      return { ...s, currentTime: new Date(nextMs) };
    });
  }, []);

  const stepBackward = useCallback(() => {
    setState((s) => {
      const prevMs = Math.max(
        s.currentTime.getTime() - 60 * 1000,
        DS_START.getTime()
      );
      return { ...s, currentTime: new Date(prevMs) };
    });
  }, []);

  const jumpToStart = useCallback(() => {
    setState((s) => ({ ...s, currentTime: DS_START }));
  }, []);

  const jumpToEnd = useCallback(() => {
    setState((s) => ({ ...s, currentTime: DS_END, isPlaying: false }));
  }, []);

  const selectIncident = useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      selectedIncidentId: id,
      activeView: id ? 'investigation' : s.activeView,
    }));
  }, []);

  const selectSignal = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedSignalId: id }));
  }, []);

  const setActiveView = useCallback((view: PlaybackState['activeView']) => {
    setState((s) => ({ ...s, activeView: view }));
  }, []);

  const progress =
    (state.currentTime.getTime() - DS_START.getTime()) / DS_RANGE_MS;

  const value: PlaybackContextValue = {
    ...state,
    play,
    pause,
    togglePlayback,
    setSpeed,
    scrubTo,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    selectIncident,
    selectSignal,
    setActiveView,
    datasetStart: DS_START,
    datasetEnd: DS_END,
    progress,
    currentTimeISO: state.currentTime.toISOString(),
  };

  return (
    <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return ctx;
}
