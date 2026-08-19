'use client';

import React from 'react';
import { WhatChangedEntry, WindowPreset, METRIC_LABELS, METRIC_UNITS, METRIC_HIGHER_IS_WORSE } from '@/lib/types';

interface WhatChangedScreenProps {
  entries: WhatChangedEntry[];
  isLoading: boolean;
  windowPreset: WindowPreset;
  onWindowChange: (preset: WindowPreset) => void;
  onSelectSignal: (signalId: string) => void;
}

export function WhatChangedScreen({ entries, isLoading, windowPreset, onWindowChange, onSelectSignal }: WhatChangedScreenProps) {
  return (
    <div className="bg-dp-bg min-h-screen p-6 text-text-primary flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-text-primary">What Changed vs Baseline</h1>
        
        <div className="flex bg-dp-surface-primary border border-dp-border rounded-lg p-1">
          {(['15m', '60m'] as WindowPreset[]).map(preset => (
            <button
              key={preset}
              onClick={() => onWindowChange(preset)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${windowPreset === preset ? 'bg-dp-surface-secondary text-text-primary shadow' : 'text-text-secondary hover:text-text-primary'}`}
              aria-pressed={windowPreset === preset}
            >
              Last {preset === '15m' ? '15 min' : '60 min'}
            </button>
          ))}
        </div>
      </header>

      <section className="bg-dp-surface-primary border border-dp-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dp-surface-secondary border-b border-dp-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="p-4 font-medium">Metric</th>
                <th className="p-4 font-medium">Region</th>
                <th className="p-4 font-medium text-right">Current</th>
                <th className="p-4 font-medium text-right">Baseline</th>
                <th className="p-4 font-medium text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dp-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-dp-surface-secondary rounded w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-dp-surface-secondary rounded w-16"></div></td>
                    <td className="p-4 flex justify-end"><div className="h-4 bg-dp-surface-secondary rounded w-16"></div></td>
                    <td className="p-4 flex justify-end"><div className="h-4 bg-dp-surface-secondary rounded w-16"></div></td>
                    <td className="p-4 flex justify-end"><div className="h-4 bg-dp-surface-secondary rounded w-12"></div></td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-secondary">
                    No metric data available for the selected window.
                  </td>
                </tr>
              ) : (
                entries.map(entry => {
                  const isMeaningful = entry.isMeaningful;
                  const isWorse = METRIC_HIGHER_IS_WORSE[entry.metric] ? entry.percentDelta > 0 : entry.percentDelta < 0;
                  const deltaColor = !isMeaningful ? 'text-text-tertiary' : isWorse ? 'text-state-critical' : 'text-state-normal';
                  
                  return (
                    <tr 
                      key={`${entry.metric}-${entry.region}`} 
                      onClick={() => isMeaningful && onSelectSignal(`${entry.metric}-${entry.region}`)}
                      className={`transition-colors ${isMeaningful ? 'hover:bg-dp-surface-secondary cursor-pointer' : 'opacity-70'}`}
                      tabIndex={isMeaningful ? 0 : -1}
                      role={isMeaningful ? 'button' : 'row'}
                    >
                      <td className={`p-4 text-sm ${isMeaningful ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
                        {METRIC_LABELS[entry.metric] || entry.metric}
                      </td>
                      <td className={`p-4 text-sm ${isMeaningful ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {entry.region}
                      </td>
                      <td className="p-4 text-sm tabular-nums text-right text-text-primary">
                        {entry.currentValue.toFixed(2)} <span className="text-text-tertiary text-xs">{METRIC_UNITS[entry.metric]}</span>
                      </td>
                      <td className="p-4 text-sm tabular-nums text-right text-text-secondary">
                        {entry.baselineValue.toFixed(2)}
                      </td>
                      <td className={`p-4 text-sm tabular-nums text-right font-medium ${deltaColor}`}>
                        {entry.percentDelta > 0 ? '+' : ''}{entry.percentDelta.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="text-xs text-text-tertiary text-right mt-2">Provider: Deterministic Insight Engine</div>
    </div>
  );
}
