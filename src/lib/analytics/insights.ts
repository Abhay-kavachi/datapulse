// ============================================================================
// DataPulse — Deterministic Insight Engine
// Generates structured plain-language explanations from computed values.
// Every inserted value comes from the analytics engine — never static copy.
// ============================================================================

import type {
  Incident,
  Anomaly,
  MetricPoint,
  Insight,
  InsightClaim,
  MetricType,
  Region,
} from '@/lib/types';
import { METRIC_LABELS, METRIC_UNITS, METRIC_BASELINES } from '@/lib/types';
import { percentChangeVsBaseline } from '@/lib/analytics/engine';

// ---------------------------------------------------------------------------
// InsightProvider Interface
// ---------------------------------------------------------------------------

export interface InsightProvider {
  generate(
    incident: Incident,
    anomalies: Anomaly[],
    metricPoints: MetricPoint[]
  ): Insight;
}

// ---------------------------------------------------------------------------
// Deterministic Insight Provider (MVP default, no API key)
// ---------------------------------------------------------------------------

export class DeterministicInsightProvider implements InsightProvider {
  generate(
    incident: Incident,
    anomalies: Anomaly[],
    metricPoints: MetricPoint[]
  ): Insight {
    const relatedAnomalies = anomalies.filter(
      (a) => a.region === incident.region && a.status !== 'resolved'
    );

    const claims: InsightClaim[] = [];
    const sentences: string[] = [];

    // Sort anomalies by start time to build the narrative chronologically
    const sorted = [...relatedAnomalies].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Build narrative from the incident stages
    for (let i = 0; i < sorted.length; i++) {
      const anomaly = sorted[i];
      const metric = anomaly.metric;
      const region = anomaly.region;
      const label = METRIC_LABELS[metric];
      const unit = METRIC_UNITS[metric];
      const baseline = METRIC_BASELINES[metric];

      // Get the current value (latest point for this metric+region)
      const latestPoint = metricPoints
        .filter((p) => p.metric === metric && p.region === region)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

      const currentValue = latestPoint?.value ?? baseline;
      const pctChange = percentChangeVsBaseline(currentValue, baseline);
      const absPct = Math.abs(Math.round(pctChange * 10) / 10);
      const direction = pctChange > 0 ? 'increased' : 'decreased';
      const time = formatTime(anomaly.startTime);

      const signalId = `${metric}-${region}`;

      if (i === 0) {
        sentences.push(
          `${label} in ${region} ${direction} ${absPct}% beginning at ${time}.`
        );
      } else {
        const prevAnomaly = sorted[i - 1];
        const lagMs =
          new Date(anomaly.startTime).getTime() -
          new Date(prevAnomaly.startTime).getTime();
        const lagMinutes = Math.round(lagMs / 60000);

        sentences.push(
          `This was followed ${lagMinutes} minute${lagMinutes !== 1 ? 's' : ''} later by a ${absPct}% ${direction.replace('ed', 'e')} in ${label} in the same region.`
        );
      }

      claims.push({
        text: `${label}: ${currentValue.toFixed(1)}${unit} (${direction} ${absPct}% from baseline ${baseline}${unit})`,
        metric,
        signalId,
        evidenceLink: `/investigation/evidence/${signalId}`,
      });
    }

    // Add composite severity line
    const maxSeverity = Math.max(...relatedAnomalies.map((a) => a.severity), 0);
    const maxConfidence = Math.max(
      ...relatedAnomalies.map((a) => a.confidence),
      0
    );
    const severityLabel =
      maxSeverity >= 70 ? 'Critical' : maxSeverity >= 45 ? 'Active' : 'Forming';

    sentences.push(
      `Composite severity: ${severityLabel} (confidence ${maxConfidence}%).`
    );

    return {
      incidentId: incident.id,
      summary: sentences.join(' '),
      provider: 'deterministic',
      providerLabel: 'Deterministic Insight Engine',
      claims,
    };
  }
}

/** Format ISO timestamp to HH:MM display */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Singleton (default provider)
// ---------------------------------------------------------------------------

let provider: InsightProvider = new DeterministicInsightProvider();

export function getInsightProvider(): InsightProvider {
  return provider;
}

export function setInsightProvider(p: InsightProvider): void {
  provider = p;
}
