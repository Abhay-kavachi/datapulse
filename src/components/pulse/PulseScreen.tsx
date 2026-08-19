'use client';

import React from 'react';
import { PulseResponse, Region, MetricSummary, RegionSummary, ActivityEntry, METRIC_LABELS, METRIC_UNITS } from '@/lib/types';

interface PulseScreenProps {
  data: PulseResponse | null;
  isLoading: boolean;
  onRegionFilter: (region: Region | null) => void;
  onSelectAnomaly: (anomalyId: string) => void;
  selectedRegion: Region | null;
}

export function PulseScreen({ data, isLoading, onRegionFilter, onSelectAnomaly, selectedRegion }: PulseScreenProps) {
  if (isLoading) {
    return (
      <div className="bg-dp-bg p-6 h-full flex flex-col gap-6 text-text-primary">
        <div className="h-12 bg-dp-surface-primary border border-dp-border rounded animate-pulse w-48"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-dp-surface-primary border border-dp-border rounded animate-pulse"></div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-dp-surface-primary border border-dp-border rounded animate-pulse"></div>)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-dp-bg p-6 h-full text-text-primary">
        <div className="bg-state-warning/10 text-state-warning p-4 rounded border border-state-warning">
          Failed to load pulse data. Please retry.
        </div>
      </div>
    );
  }

  const { health, regions, metrics, activityFeed } = data;

  const getHealthColor = (h: string) => {
    if (h === 'critical') return 'text-state-critical bg-state-critical/10 border-state-critical';
    if (h === 'warning') return 'text-state-warning bg-state-warning/10 border-state-warning';
    return 'text-state-normal bg-state-normal/10 border-state-normal';
  };

  return (
    <div className="bg-dp-bg min-h-screen p-6 text-text-primary flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">System Pulse</h1>
        <div className={`px-4 py-2 rounded border flex items-center gap-2 ${getHealthColor(health)}`}>
          <span className="font-medium text-sm uppercase tracking-wider">Health: {health}</span>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-medium text-text-secondary mb-4">Regions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {regions.map((regionData: RegionSummary) => {
            const isSelected = selectedRegion === regionData.region;
            const statusColor = regionData.status === 'critical' ? 'bg-state-critical' : regionData.status === 'warning' ? 'bg-state-warning' : 'bg-state-normal';
            return (
              <button
                key={regionData.region}
                onClick={() => onRegionFilter(isSelected ? null : regionData.region)}
                className={`p-4 rounded border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-state-info ${isSelected ? 'border-text-primary bg-dp-surface-secondary' : 'border-dp-border bg-dp-surface-primary hover:border-text-secondary'}`}
                aria-pressed={isSelected}
                aria-label={`Filter by region ${regionData.region}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-lg text-text-primary">{regionData.region}</span>
                  <div className={`w-3 h-3 rounded-full ${statusColor}`} aria-label={`Status: ${regionData.status}`} />
                </div>
                <div className="text-sm text-text-secondary">
                  <span className="tabular-nums font-semibold text-text-primary">{regionData.activeAnomalies}</span> active anomalies
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-text-secondary mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric: MetricSummary) => (
            <div key={metric.metric} className="p-4 rounded border border-dp-border bg-dp-surface-primary flex flex-col justify-between">
              <div>
                <div className="text-sm text-text-tertiary mb-1 uppercase tracking-wider">{METRIC_LABELS[metric.metric as keyof typeof METRIC_LABELS] || metric.metric}</div>
                <div className="flex justify-between items-end mb-4">
                  <div className="text-2xl font-semibold tabular-nums text-text-primary">
                    {metric.currentValue} <span className="text-sm font-normal text-text-secondary">{METRIC_UNITS[metric.metric as keyof typeof METRIC_UNITS] || ''}</span>
                  </div>
                  <div className={`text-sm tabular-nums flex items-center gap-1 font-medium ${metric.trendPercent > 0 ? 'text-state-warning' : metric.trendPercent < 0 ? 'text-state-info' : 'text-text-secondary'}`}>
                    {metric.trendPercent > 0 ? '↑' : metric.trendPercent < 0 ? '↓' : '→'} {Math.abs(metric.trendPercent)}%
                  </div>
                </div>
              </div>
              <div className="h-10 w-full mt-2">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <path
                    d={`M ${metric.sparkline.map((val, idx) => `${(idx / Math.max(1, metric.sparkline.length - 1)) * 100}% ${100 - ((val - Math.min(...metric.sparkline)) / (Math.max(1, Math.max(...metric.sparkline) - Math.min(...metric.sparkline))) * 100)}%`).join(' L ')}`}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-text-secondary mb-4">Recent Activity</h2>
        {activityFeed.length === 0 ? (
          <div className="p-8 text-center text-state-normal bg-state-normal/5 border border-state-normal/20 rounded">
            System is operating normally. No recent anomalies detected.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-2">
            {activityFeed.map((entry: ActivityEntry) => (
              <button
                key={entry.id}
                onClick={() => entry.anomalyId && onSelectAnomaly(entry.anomalyId)}
                className="flex items-center gap-4 p-3 rounded border border-dp-border bg-dp-surface-primary hover:bg-dp-surface-secondary text-left transition-colors focus:outline-none focus:ring-2 focus:ring-state-info"
                aria-label={`View anomaly details for ${entry.message}`}
              >
                <div className="text-sm text-text-tertiary w-20 tabular-nums shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex-1 text-sm text-text-primary">{entry.message}</div>
                <div className="text-text-tertiary text-xs shrink-0 font-medium">View &rarr;</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
