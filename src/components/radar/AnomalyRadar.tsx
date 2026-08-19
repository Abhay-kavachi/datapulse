'use client';

import React from 'react';
import { Anomaly, Region, MetricType, AnomalyStatus, METRICS, REGIONS, ANOMALY_STATUSES, METRIC_LABELS } from '@/lib/types';

interface AnomalyRadarProps {
  anomalies: Anomaly[];
  isLoading: boolean;
  onSelectAnomaly: (anomalyId: string) => void;
  onJumpToTime: (time: string) => void;
  filters: { region?: Region; metric?: MetricType; status?: AnomalyStatus; minSeverity?: number };
  onFiltersChange: (filters: any) => void;
}

export function AnomalyRadar({ anomalies, isLoading, onSelectAnomaly, onJumpToTime, filters, onFiltersChange }: AnomalyRadarProps) {
  if (isLoading) {
    return (
      <div className="bg-dp-bg min-h-screen p-6 text-text-primary flex flex-col gap-6">
        <div className="h-14 bg-dp-surface-primary border border-dp-border rounded animate-pulse w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-dp-surface-primary border border-dp-border rounded animate-pulse"></div>)}
        </div>
      </div>
    );
  }

  const handleFilterChange = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-dp-bg min-h-screen p-6 text-text-primary flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text-primary">Anomaly Radar</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="bg-dp-surface-primary border border-dp-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-text-secondary"
            value={filters.region || ''}
            onChange={(e) => handleFilterChange('region', e.target.value || undefined)}
            aria-label="Filter by region"
          >
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          
          <select
            className="bg-dp-surface-primary border border-dp-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-text-secondary"
            value={filters.metric || ''}
            onChange={(e) => handleFilterChange('metric', e.target.value || undefined)}
            aria-label="Filter by metric"
          >
            <option value="">All Metrics</option>
            {METRICS.map(m => <option key={m} value={m}>{METRIC_LABELS[m] || m}</option>)}
          </select>

          <select
            className="bg-dp-surface-primary border border-dp-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-text-secondary"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {ANOMALY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="flex items-center gap-2 bg-dp-surface-primary border border-dp-border rounded px-3 py-1.5">
            <label htmlFor="minSeverity" className="text-sm text-text-secondary">Min Sev:</label>
            <input
              id="minSeverity"
              type="range"
              min="0"
              max="100"
              value={filters.minSeverity || 0}
              onChange={(e) => handleFilterChange('minSeverity', parseInt(e.target.value, 10))}
              className="w-24 accent-state-info"
            />
            <span className="text-sm tabular-nums w-6 text-right">{filters.minSeverity || 0}</span>
          </div>
        </div>
      </header>

      <section>
        {anomalies.length === 0 ? (
          <div className="p-12 text-center text-text-secondary bg-dp-surface-primary border border-dp-border rounded flex flex-col items-center gap-2">
            <div className="text-xl font-medium text-text-primary">No Anomalies Found</div>
            <div>{Object.keys(filters).length > 0 ? 'Try adjusting your filters.' : 'All systems operating within normal parameters.'}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {anomalies.map((anomaly) => {
              const sevColor = anomaly.severity >= 80 ? 'bg-state-critical border-state-critical text-dp-bg' : anomaly.severity >= 50 ? 'bg-state-warning border-state-warning text-dp-bg' : 'bg-state-info border-state-info text-dp-bg';
              const statusColor = anomaly.status === 'active' ? 'text-state-critical' : anomaly.status === 'forming' ? 'text-state-warning' : 'text-text-secondary';
              
              return (
                <div key={anomaly.id} className="p-4 rounded border border-dp-border bg-dp-surface-primary flex flex-col gap-3 hover:border-text-secondary transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs text-text-tertiary uppercase tracking-wider mb-0.5">{anomaly.region}</div>
                      <div className="font-semibold text-text-primary">{METRIC_LABELS[anomaly.metric] || anomaly.metric}</div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold ${sevColor}`} aria-label={`Severity ${anomaly.severity}`}>
                      {anomaly.severity}
                    </div>
                  </div>
                  
                  <div className="text-sm text-text-secondary tabular-nums">
                    {new Date(anomaly.startTime).toLocaleString()}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded bg-dp-surface-secondary border border-dp-border ${statusColor}`}>
                      {anomaly.status}
                    </span>
                    <span className="px-2 py-1 rounded bg-dp-surface-secondary border border-dp-border text-text-secondary">
                      {anomaly.confidence}% Confidence
                    </span>
                  </div>

                  <div className="text-sm text-text-secondary line-clamp-2 mb-2">
                    {anomaly.triggeringCriteria.join(', ')}
                  </div>

                  <div className="mt-auto flex gap-2 pt-2 border-t border-dp-border">
                    <button
                      onClick={() => onSelectAnomaly(anomaly.id)}
                      className="flex-1 py-1.5 text-sm font-medium text-text-primary bg-dp-surface-secondary hover:bg-dp-border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-state-info"
                    >
                      Investigate
                    </button>
                    <button
                      onClick={() => onJumpToTime(anomaly.startTime)}
                      className="flex-1 py-1.5 text-sm font-medium text-state-info bg-state-info/10 hover:bg-state-info/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-state-info"
                    >
                      Jump to Time
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
