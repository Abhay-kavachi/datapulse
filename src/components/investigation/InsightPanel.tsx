'use client';

import React from 'react';
import type { Insight } from '@/lib/types';
import { METRIC_LABELS } from '@/lib/types';

interface InsightPanelProps {
  insight: Insight | null;
  isLoading: boolean;
  onViewEvidence: (signalId: string) => void;
}

export default function InsightPanel({
  insight,
  isLoading,
  onViewEvidence,
}: InsightPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-dp-surface-primary border border-dp-border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-dp-surface-secondary rounded w-1/3" />
          <div className="h-3 bg-dp-surface-secondary rounded w-full" />
          <div className="h-3 bg-dp-surface-secondary rounded w-5/6" />
          <div className="h-3 bg-dp-surface-secondary rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="bg-dp-surface-primary border border-dp-border rounded-lg p-6">
        <p className="text-text-tertiary text-sm">
          Select an anomaly to see its explanation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-dp-surface-primary border border-dp-border rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          Insight Engine
        </h3>
        <span className="text-xs text-text-tertiary bg-dp-surface-secondary px-2 py-1 rounded">
          {insight.providerLabel}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-text-secondary leading-relaxed">
        {insight.summary}
      </p>

      {/* Evidence links */}
      {insight.claims.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-dp-border-subtle">
          <p className="text-xs text-text-tertiary uppercase tracking-wider">
            Supporting Evidence
          </p>
          {insight.claims.map((claim, i) => (
            <button
              key={i}
              onClick={() => onViewEvidence(claim.signalId)}
              className="w-full text-left px-3 py-2 rounded bg-dp-surface-secondary
                         hover:bg-dp-surface-elevated transition-colors duration-150
                         border border-transparent hover:border-dp-border group"
              aria-label={`View evidence for ${METRIC_LABELS[claim.metric]}`}
            >
              <span className="text-xs text-text-secondary group-hover:text-text-primary">
                {claim.text}
              </span>
              <span className="text-xs text-state-info ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                View evidence →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
