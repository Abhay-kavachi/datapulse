'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PlaybackProvider, usePlayback } from '@/contexts/PlaybackContext';
import type {
  PulseResponse,
  Anomaly,
  CascadeState,
  Insight,
  EvidenceData,
  WhatChangedEntry,
  Region,
  MetricType,
  AnomalyStatus,
  WindowPreset,
} from '@/lib/types';
import { PulseScreen } from '@/components/pulse/PulseScreen';
import { AnomalyRadar } from '@/components/radar/AnomalyRadar';
import CascadeReplay from '@/components/investigation/CascadeReplay';
import InsightPanel from '@/components/investigation/InsightPanel';
import { EvidencePanel } from '@/components/investigation/EvidencePanel';
import { WhatChangedScreen } from '@/components/what-changed/WhatChangedScreen';
import ScenarioSelector from '@/components/scenarios/ScenarioSelector';

// ---------------------------------------------------------------------------
// App Shell (inner, needs PlaybackContext)
// ---------------------------------------------------------------------------

function AppShell() {
  const pb = usePlayback();

  // Data states
  const [pulseData, setPulseData] = useState<PulseResponse | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [cascadeState, setCascadeState] = useState<CascadeState | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [whatChanged, setWhatChanged] = useState<WhatChangedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [regionFilter, setRegionFilter] = useState<Region | null>(null);
  const [anomalyFilters, setAnomalyFilters] = useState<{
    region?: Region;
    metric?: MetricType;
    status?: AnomalyStatus;
    minSeverity?: number;
  }>({});
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('15m');
  const [cascadeScrubTime, setCascadeScrubTime] = useState<string>(pb.currentTimeISO);
  const [incidentTimeRange, setIncidentTimeRange] = useState<{
    start: string;
    end: string;
  }>({ start: '2024-01-15T14:15:00Z', end: '2024-01-15T15:20:00Z' });

  // Data fetching
  const fetchPulse = useCallback(async () => {
    try {
      const params = new URLSearchParams({ t: pb.currentTimeISO });
      if (regionFilter) params.set('region', regionFilter);
      const res = await fetch(`/api/pulse?${params}`);
      if (res.ok) setPulseData(await res.json());
    } catch (e) {
      console.error('Pulse fetch error:', e);
    }
  }, [pb.currentTimeISO, regionFilter]);

  const fetchAnomalies = useCallback(async () => {
    try {
      const params = new URLSearchParams({ t: pb.currentTimeISO });
      if (anomalyFilters.region) params.set('region', anomalyFilters.region);
      if (anomalyFilters.metric) params.set('metric', anomalyFilters.metric);
      if (anomalyFilters.status) params.set('status', anomalyFilters.status);
      if (anomalyFilters.minSeverity)
        params.set('minSeverity', String(anomalyFilters.minSeverity));
      const res = await fetch(`/api/anomalies?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAnomalies(data.anomalies);
      }
    } catch (e) {
      console.error('Anomalies fetch error:', e);
    }
  }, [pb.currentTimeISO, anomalyFilters]);

  const fetchCascade = useCallback(async () => {
    if (!pb.selectedIncidentId) return;
    try {
      const res = await fetch(
        `/api/cascade/${pb.selectedIncidentId}?t=${encodeURIComponent(cascadeScrubTime)}`
      );
      if (res.ok) setCascadeState(await res.json());
    } catch (e) {
      console.error('Cascade fetch error:', e);
    }
  }, [pb.selectedIncidentId, cascadeScrubTime]);

  const fetchInsight = useCallback(async () => {
    if (!pb.selectedIncidentId) return;
    try {
      const res = await fetch(`/api/insight/${pb.selectedIncidentId}`);
      if (res.ok) setInsight(await res.json());
    } catch (e) {
      console.error('Insight fetch error:', e);
    }
  }, [pb.selectedIncidentId]);

  const fetchEvidence = useCallback(async () => {
    if (!pb.selectedSignalId) return;
    try {
      const res = await fetch(
        `/api/evidence/${pb.selectedSignalId}?t=${encodeURIComponent(pb.currentTimeISO)}`
      );
      if (res.ok) setEvidence(await res.json());
    } catch (e) {
      console.error('Evidence fetch error:', e);
    }
  }, [pb.selectedSignalId, pb.currentTimeISO]);

  const fetchWhatChanged = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/what-changed?t=${encodeURIComponent(pb.currentTimeISO)}&window=${windowPreset}`
      );
      if (res.ok) {
        const data = await res.json();
        setWhatChanged(data.entries);
      }
    } catch (e) {
      console.error('What-changed fetch error:', e);
    }
  }, [pb.currentTimeISO, windowPreset]);

  // Fetch data based on active view
  useEffect(() => {
    const view = pb.activeView;
    if (view === 'pulse') fetchPulse();
    if (view === 'radar') fetchAnomalies();
    if (view === 'investigation') {
      fetchCascade();
      fetchInsight();
      if (pb.selectedSignalId) fetchEvidence();
    }
    if (view === 'what-changed') fetchWhatChanged();
  }, [
    pb.activeView,
    pb.currentTimeISO,
    fetchPulse,
    fetchAnomalies,
    fetchCascade,
    fetchInsight,
    fetchEvidence,
    fetchWhatChanged,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.target) {
        e.preventDefault();
        pb.togglePlayback();
      }
      if (e.key === 'ArrowRight') pb.stepForward();
      if (e.key === 'ArrowLeft') pb.stepBackward();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pb]);

  // Handlers
  const handleSelectAnomaly = useCallback(
    (anomalyId: string) => {
      // Find the anomaly and set up investigation
      const anomaly = anomalies.find((a) => a.id === anomalyId);
      if (anomaly) {
        // Construct the incident ID from the anomaly
        pb.selectIncident(`inc-${pb.currentTimeISO.includes('inc-') ? '' : 'apac-checkout'}`);
        pb.selectSignal(`${anomaly.metric}-${anomaly.region}`);
        pb.setActiveView('investigation');
      }
    },
    [anomalies, pb]
  );

  const handleScenarioChange = useCallback(
    (scenarioId: string, timeRange: { start: string; end: string }) => {
      setIncidentTimeRange(timeRange);
      // Jump to incident time range
      const start = new Date(timeRange.start);
      pb.scrubTo(start);
      // Re-initialize incident ID
      pb.selectIncident(`inc-${scenarioId}`);
      pb.setActiveView('pulse');
      // Re-fetch everything
      setPulseData(null);
      setAnomalies([]);
      setCascadeState(null);
    },
    [pb]
  );

  const handleCascadeScrub = useCallback((time: string) => {
    setCascadeScrubTime(time);
  }, []);

  const handleSelectSignal = useCallback(
    (signalId: string) => {
      pb.selectSignal(signalId);
    },
    [pb]
  );

  // Format time display
  const formatCurrentTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')} UTC`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const views = [
    { id: 'pulse' as const, label: 'Pulse', icon: '◉' },
    { id: 'radar' as const, label: 'Radar', icon: '◎' },
    { id: 'investigation' as const, label: 'Investigate', icon: '⬡' },
    { id: 'what-changed' as const, label: 'What Changed', icon: '⇄' },
  ];

  return (
    <div className="h-screen flex flex-col bg-dp-bg overflow-hidden">
      {/* ─── TOP BAR ─── */}
      <header className="h-14 border-b border-dp-border bg-dp-surface-primary flex items-center px-4 gap-4 flex-shrink-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-state-info to-blue-700 flex items-center justify-center">
            <span className="text-white text-xs font-bold">DP</span>
          </div>
          <span className="text-sm font-semibold text-text-primary hidden sm:block">
            DataPulse
          </span>
        </div>

        {/* Scenario Selector */}
        <ScenarioSelector onScenarioChange={handleScenarioChange} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={pb.jumpToStart}
            className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Jump to start"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" />
            </svg>
          </button>

          <button
            onClick={pb.togglePlayback}
            className="p-2 rounded-md bg-dp-surface-secondary hover:bg-dp-surface-elevated
                       border border-dp-border text-text-primary transition-colors"
            aria-label={pb.isPlaying ? 'Pause' : 'Play'}
          >
            {pb.isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button
            onClick={pb.jumpToEnd}
            className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Jump to end"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm6 0a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" />
            </svg>
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 border-l border-dp-border pl-3">
          {([1, 4, 30] as const).map((s) => (
            <button
              key={s}
              onClick={() => pb.setSpeed(s)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                pb.speed === s
                  ? 'bg-state-info/20 text-state-info border border-state-info/30'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
              aria-label={`Set speed to ${s}x`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3 border-l border-dp-border pl-3 min-w-[200px]">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={pb.progress}
            onChange={(e) => {
              const p = parseFloat(e.target.value);
              const ms =
                pb.datasetStart.getTime() +
                p * (pb.datasetEnd.getTime() - pb.datasetStart.getTime());
              pb.scrubTo(new Date(ms));
            }}
            className="w-full h-1 bg-dp-border rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-state-info [&::-webkit-slider-thumb]:cursor-pointer"
            aria-label="Timeline scrubber"
          />
          <span className="text-xs tabular-nums text-text-secondary whitespace-nowrap font-mono">
            {formatCurrentTime(pb.currentTimeISO)}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── ICON RAIL ─── */}
        <nav
          className="w-14 border-r border-dp-border bg-dp-surface-primary flex flex-col items-center
                     py-4 gap-2 flex-shrink-0"
          aria-label="Main navigation"
        >
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => pb.setActiveView(v.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all
                ${
                  pb.activeView === v.id
                    ? 'bg-state-info/15 text-state-info border border-state-info/30'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-dp-surface-secondary'
                }`}
              aria-label={v.label}
              title={v.label}
            >
              {v.icon}
            </button>
          ))}

          <div className="flex-1" />

          {/* Demo badge */}
          <div className="text-center">
            <span className="text-[9px] text-text-muted leading-tight block">
              DEMO
            </span>
            <span className="text-[9px] text-text-muted leading-tight block">
              BUILD
            </span>
          </div>
        </nav>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {pb.activeView === 'pulse' && (
            <PulseScreen
              data={pulseData}
              isLoading={!pulseData}
              onRegionFilter={setRegionFilter}
              onSelectAnomaly={handleSelectAnomaly}
              selectedRegion={regionFilter}
            />
          )}

          {pb.activeView === 'radar' && (
            <AnomalyRadar
              anomalies={anomalies}
              isLoading={false}
              onSelectAnomaly={handleSelectAnomaly}
              onJumpToTime={(t: string) => pb.scrubTo(new Date(t))}
              filters={anomalyFilters}
              onFiltersChange={setAnomalyFilters}
            />
          )}

          {pb.activeView === 'investigation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">
                  Investigation
                </h2>
                <button
                  onClick={() => pb.setActiveView('pulse')}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  ← Back to Pulse
                </button>
              </div>

              {/* Cascade Replay */}
              <CascadeReplay
                cascadeState={cascadeState}
                incidentTimeRange={incidentTimeRange}
                onSelectSignal={handleSelectSignal}
                onScrubTimeChange={handleCascadeScrub}
                isLoading={!cascadeState && !!pb.selectedIncidentId}
              />

              {/* Insight + Evidence panels side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <InsightPanel
                  insight={insight}
                  isLoading={!insight && !!pb.selectedIncidentId}
                  onViewEvidence={handleSelectSignal}
                />
                <EvidencePanel
                  evidence={evidence}
                  isLoading={!evidence && !!pb.selectedSignalId}
                  availableSignals={
                    cascadeState?.nodes.map((n) => `${n.metric}-${cascadeState.incidentId.replace('inc-', '')}`) ?? []
                  }
                  selectedSignal={pb.selectedSignalId ?? ''}
                  onSelectSignal={handleSelectSignal}
                />
              </div>
            </div>
          )}

          {pb.activeView === 'what-changed' && (
            <WhatChangedScreen
              entries={whatChanged}
              isLoading={whatChanged.length === 0}
              windowPreset={windowPreset}
              onWindowChange={setWindowPreset}
              onSelectSignal={handleSelectSignal}
            />
          )}
        </main>
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="h-8 border-t border-dp-border bg-dp-surface-primary flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-[10px] text-text-muted">
          DataPulse — Functional Prototype · Synthetic Data · No Authentication
        </span>
        <span className="text-[10px] text-text-muted">
          Simulated Replay · Deterministic Analytics · No ML
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (wrapped in PlaybackProvider)
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <PlaybackProvider>
      <AppShell />
    </PlaybackProvider>
  );
}
