// ============================================================================
// DataPulse — Cascade Edge Detection
// Proposes directed edges between co-anomalous signals using correlation.
// Labels: "correlated", NEVER "caused".
// ============================================================================

import type {
  MetricType,
  Region,
  Anomaly,
  MetricPoint,
  CascadeEdge,
  CascadeNode,
  CascadeNodeStatus,
  CascadeState,
  Incident,
} from '@/lib/types';
import { METRIC_BASELINES, METRIC_LABELS } from '@/lib/types';
import { correlate, percentChangeVsBaseline } from '@/lib/analytics/engine';

const MAX_LAG_MINUTES = 10;
const MIN_CORRELATION_SCORE = 0.5;

/**
 * The canonical cascade order. Edges are proposed following this
 * sequence when correlation is detected within the lag window.
 */
const CASCADE_ORDER: MetricType[] = [
  'traffic',
  'checkout_latency_ms',
  'payment_failure_rate',
  'conversion_rate',
  'error_rate',
  'revenue_index',
];

/**
 * Detect cascade edges between co-anomalous signals in the same region.
 * Uses bounded cross-correlation to propose directed edges.
 */
export function detectCascadeEdges(
  metricPoints: MetricPoint[],
  anomalies: Anomaly[],
  incident: Incident,
  upToTime: string
): CascadeEdge[] {
  const edges: CascadeEdge[] = [];
  const region = incident.region;
  const upToMs = new Date(upToTime).getTime();

  // Get anomalous metrics in this region at this time
  const activeAnomalies = anomalies.filter(
    (a) =>
      a.region === region &&
      new Date(a.startTime).getTime() <= upToMs &&
      (a.endTime === null || new Date(a.endTime).getTime() >= upToMs - 30 * 60 * 1000)
  );

  const anomalousMetrics = new Set(activeAnomalies.map((a) => a.metric));

  // For each consecutive pair in cascade order, check correlation
  for (let i = 0; i < CASCADE_ORDER.length - 1; i++) {
    const from = CASCADE_ORDER[i];
    const to = CASCADE_ORDER[i + 1];

    // Both must be anomalous (or have been anomalous) for edge to exist
    if (!anomalousMetrics.has(from) && !anomalousMetrics.has(to)) continue;
    // At least the "from" should be anomalous
    if (!anomalousMetrics.has(from)) continue;

    // Get series for both metrics in the incident window
    const seriesA = metricPoints
      .filter(
        (p) =>
          p.metric === from &&
          p.region === region &&
          new Date(p.timestamp).getTime() <= upToMs
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((p) => p.value);

    const seriesB = metricPoints
      .filter(
        (p) =>
          p.metric === to &&
          p.region === region &&
          new Date(p.timestamp).getTime() <= upToMs
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((p) => p.value);

    if (seriesA.length < MAX_LAG_MINUTES + 2 || seriesB.length < MAX_LAG_MINUTES + 2) continue;

    // Use the last 30 minutes of data for correlation
    const windowSize = Math.min(30, seriesA.length);
    const sliceA = seriesA.slice(-windowSize);
    const sliceB = seriesB.slice(-windowSize);

    const { score, lagMinutes } = correlate(sliceA, sliceB, MAX_LAG_MINUTES);

    if (Math.abs(score) >= MIN_CORRELATION_SCORE) {
      edges.push({
        from,
        to,
        correlationScore: Math.round(score * 100) / 100,
        lagMinutes,
        label: 'correlated', // NEVER "caused"
      });
    }
  }

  return edges;
}

/**
 * Get the cascade state (nodes + edges) for a specific incident at a specific time.
 * This is the primary data structure driving the Cascade Replay visualization.
 */
export function getCascadeState(
  metricPoints: MetricPoint[],
  anomalies: Anomaly[],
  incident: Incident,
  atTime: string
): CascadeState {
  const atMs = new Date(atTime).getTime();
  const region = incident.region;

  // Build nodes for all metrics involved in cascade order
  const nodes: CascadeNode[] = CASCADE_ORDER.map((metric) => {
    // Find latest metric point at or before atTime
    const points = metricPoints
      .filter(
        (p) =>
          p.metric === metric &&
          p.region === region &&
          new Date(p.timestamp).getTime() <= atMs
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const latest = points[points.length - 1];
    const baseline = METRIC_BASELINES[metric];
    const currentValue = latest?.value ?? baseline;
    const pctChange = percentChangeVsBaseline(currentValue, baseline);

    // Determine node status from anomaly state
    const anomaly = anomalies.find(
      (a) =>
        a.metric === metric &&
        a.region === region &&
        new Date(a.startTime).getTime() <= atMs &&
        (a.endTime === null || new Date(a.endTime).getTime() >= atMs - 5 * 60 * 1000)
    );

    let status: CascadeNodeStatus = 'inactive';
    if (anomaly) {
      if (anomaly.status === 'resolved') {
        status = 'resolved';
      } else {
        status = anomaly.status as CascadeNodeStatus;
      }
    }

    return {
      metric,
      status,
      value: Math.round(currentValue * 100) / 100,
      baseline,
      percentChange: Math.round(pctChange * 10) / 10,
      timestamp: latest?.timestamp ?? atTime,
    };
  });

  // Build edges
  const edges = detectCascadeEdges(metricPoints, anomalies, incident, atTime);

  return {
    incidentId: incident.id,
    nodes,
    edges,
    currentTime: atTime,
  };
}
