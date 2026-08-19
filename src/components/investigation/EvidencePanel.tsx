'use client';

import React from 'react';
import { EvidenceData, CriterionResult, EvidenceChartPoint, METRIC_LABELS, METRIC_UNITS } from '@/lib/types';

interface EvidencePanelProps {
  evidence: EvidenceData | null;
  isLoading: boolean;
  availableSignals: string[];
  selectedSignal: string;
  onSelectSignal: (signalId: string) => void;
}

export function EvidencePanel({ evidence, isLoading, availableSignals, selectedSignal, onSelectSignal }: EvidencePanelProps) {
  if (isLoading) {
    return (
      <div className="bg-dp-bg p-6 h-full flex flex-col gap-6 text-text-primary">
        <div className="flex gap-2 mb-4">
          {[1, 2].map(i => <div key={i} className="h-8 w-24 bg-dp-surface-primary border border-dp-border rounded animate-pulse"></div>)}
        </div>
        <div className="h-64 bg-dp-surface-primary border border-dp-border rounded animate-pulse w-full"></div>
        <div className="h-32 bg-dp-surface-primary border border-dp-border rounded animate-pulse w-full"></div>
        <div className="h-48 bg-dp-surface-primary border border-dp-border rounded animate-pulse w-full"></div>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="bg-dp-bg p-6 h-full flex items-center justify-center text-text-secondary border border-dp-border rounded">
        Select a signal to view evidence.
      </div>
    );
  }

  // Chart computations
  const chartData = evidence.chartData;
  const values = chartData.map(d => d.value);
  const means = chartData.map(d => d.rollingMean);
  const upperBands = chartData.map(d => d.upperBand);
  const lowerBands = chartData.map(d => d.lowerBand);

  const minVal = Math.min(...values, ...lowerBands);
  const maxVal = Math.max(...values, ...upperBands);
  const range = maxVal - minVal || 1;

  const getY = (val: number) => 100 - ((val - minVal) / range) * 100;
  const getX = (index: number) => (index / Math.max(1, chartData.length - 1)) * 100;

  const valuePath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');
  const meanPath = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.rollingMean)}`).join(' ');
  
  // Create band path (forward on upper, backward on lower)
  const bandPath = [
    ...chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.upperBand)}`),
    ...chartData.slice().reverse().map((d, i) => `L ${getX(chartData.length - 1 - i)} ${getY(d.lowerBand)}`),
    'Z'
  ].join(' ');

  return (
    <div className="bg-dp-bg p-6 text-text-primary flex flex-col gap-6">
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-dp-border">
        {availableSignals.map(sig => (
          <button
            key={sig}
            onClick={() => onSelectSignal(sig)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${selectedSignal === sig ? 'text-text-primary border-state-info bg-dp-surface-secondary' : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-dp-surface-primary'}`}
            aria-selected={selectedSignal === sig}
            role="tab"
          >
            {METRIC_LABELS[sig.split("-")[0] as keyof typeof METRIC_LABELS] || sig}
          </button>
        ))}
      </div>

      <div className="bg-dp-surface-primary p-4 rounded border border-dp-border">
        <h3 className="text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider">Signal Distribution</h3>
        <div className="h-64 w-full relative">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* StdDev Band */}
            <path d={bandPath} fill="currentColor" className="text-state-info opacity-10" />
            {/* Rolling Mean */}
            <path d={meanPath} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="text-text-tertiary" />
            {/* Raw Values */}
            <path d={valuePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-state-warning" />
          </svg>
          <div className="absolute top-0 right-0 flex gap-4 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-state-warning"></div> Actual</div>
            <div className="flex items-center gap-1"><div className="w-3 h-0.5 border-t-2 border-dashed border-text-tertiary"></div> Mean</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-state-info opacity-20"></div> ±1 StdDev</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Value', val: evidence.currentValue.toFixed(2) },
          { label: 'Rolling Mean', val: evidence.stats.mean.toFixed(2) },
          { label: 'Rolling StdDev', val: evidence.stats.stdDev.toFixed(2) },
          { label: 'Z-Score', val: evidence.stats.zScore.toFixed(2) },
          { label: '% Change', val: `${evidence.stats.percentChange > 0 ? '+' : ''}${evidence.stats.percentChange.toFixed(1)}%` },
          { label: 'vs Baseline', val: `${evidence.stats.percentChangeVsBaseline > 0 ? '+' : ''}${evidence.stats.percentChangeVsBaseline.toFixed(1)}%` },
          { label: 'Rate of Change', val: evidence.stats.rateOfChange.toFixed(2) }
        ].map(stat => (
          <div key={stat.label} className="p-3 bg-dp-surface-primary border border-dp-border rounded flex flex-col gap-1">
            <span className="text-xs text-text-secondary">{stat.label}</span>
            <span className="text-lg font-semibold tabular-nums text-text-primary">{stat.val}</span>
          </div>
        ))}
      </div>

      <div className="bg-dp-surface-primary rounded border border-dp-border overflow-hidden">
        <h3 className="text-sm font-medium text-text-secondary p-4 border-b border-dp-border uppercase tracking-wider bg-dp-surface-secondary">Detection Criteria</h3>
        <ul className="divide-y divide-dp-border">
          {evidence.criteriaResults.map((crit: CriterionResult, idx: number) => (
            <li key={idx} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {crit.met ? (
                  <div className="text-state-normal" aria-label="Criterion met">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                ) : (
                  <div className="text-text-tertiary" aria-label="Criterion not met">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                )}
                <span className={`text-sm ${crit.met ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>{crit.name}</span>
              </div>
              <div className="text-sm tabular-nums text-text-tertiary">
                {crit.value} vs {crit.threshold}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-xs text-text-tertiary text-right">Provider: Deterministic Insight Engine</div>
    </div>
  );
}
