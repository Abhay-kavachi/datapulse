// ============================================================================
// DataPulse — In-Memory Dataset Store
// Module-level singleton, generated once at boot. Never externally writable.
// Query helpers accept only typed enum values (allow-list safe).
// ============================================================================

import type {
  MetricPoint,
  EventPoint,
  Anomaly,
  Incident,
  MetricType,
  Region,
  AnomalyStatus,
  MetricSummary,
  RegionSummary,
  ActivityEntry,
  WhatChangedEntry,
  EvidenceData,
  EvidenceChartPoint,
  CascadeState,
  Insight,
  WindowPreset,
} from '@/lib/types';
import { METRICS, REGIONS, METRIC_BASELINES, METRIC_LABELS, METRIC_UNITS } from '@/lib/types';
import { generateDataset, type GeneratedDataset } from '@/lib/data/generator';
import { detectAllAnomalies, getAnomaliesAtTime } from '@/lib/analytics/detector';
import { getCascadeState } from '@/lib/analytics/cascade';
import { getInsightProvider } from '@/lib/analytics/insights';
import {
  computeRollingStats,
  rollingMean,
  rollingStdDev,
  percentChangeVsBaseline,
  DEFAULT_ROLLING_WINDOW,
} from '@/lib/analytics/engine';
import { DEFAULT_SCENARIO_ID } from '@/lib/data/scenarios';

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------

interface StoreState {
  dataset: GeneratedDataset;
  anomalies: Anomaly[];
  initialized: boolean;
}

let state: StoreState | null = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize or re-initialize the store with a specific scenario.
 * Generates the dataset, runs full anomaly detection, and caches results.
 */
export function initializeStore(scenarioId: string = DEFAULT_SCENARIO_ID): void {
  console.log(`[DataPulse] Initializing store with scenario: ${scenarioId}`);
  const startTime = Date.now();

  const dataset = generateDataset(scenarioId);
  const anomalies = detectAllAnomalies(dataset.metricPoints);

  // Link detected anomalies back to ground-truth incidents
  for (const incident of dataset.incidents) {
    incident.anomalyIds = anomalies
      .filter((a) => a.region === incident.region)
      .map((a) => a.id);
  }

  state = { dataset, anomalies, initialized: true };

  const elapsed = Date.now() - startTime;
  console.log(
    `[DataPulse] Store initialized in ${elapsed}ms. ` +
    `Points: ${dataset.metricPoints.length}, ` +
    `Anomalies: ${anomalies.length}, ` +
    `Incidents: ${dataset.incidents.length}, ` +
    `Seed: ${dataset.seed}`
  );
}

function ensureInitialized(): StoreState {
  if (!state) {
    initializeStore();
  }
  return state!;
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

/** Get a slice of metric points for a specific metric+region within a time range */
export function getMetricSlice(
  metric: MetricType,
  region: Region,
  from: string,
  to: string
): MetricPoint[] {
  const s = ensureInitialized();
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  return s.dataset.metricPoints.filter(
    (p) =>
      p.metric === metric &&
      p.region === region &&
      new Date(p.timestamp).getTime() >= fromMs &&
      new Date(p.timestamp).getTime() <= toMs
  );
}

/** Get all metric points up to a time */
export function getMetricPointsUpTo(
  metric: MetricType,
  region: Region,
  upTo: string
): MetricPoint[] {
  const s = ensureInitialized();
  const upToMs = new Date(upTo).getTime();

  return s.dataset.metricPoints
    .filter(
      (p) =>
        p.metric === metric &&
        p.region === region &&
        new Date(p.timestamp).getTime() <= upToMs
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/** Get all anomalies visible at a specific time with optional filters */
export function queryAnomalies(
  atTime: string,
  filters?: {
    region?: Region;
    metric?: MetricType;
    status?: AnomalyStatus;
    minSeverity?: number;
  }
): Anomaly[] {
  const s = ensureInitialized();
  return getAnomaliesAtTime(s.anomalies, atTime, filters);
}

/** Get a specific incident by ID */
export function getIncident(incidentId: string): Incident | undefined {
  const s = ensureInitialized();
  return s.dataset.incidents.find((i) => i.id === incidentId);
}

/** Get all incidents */
export function getIncidents(): Incident[] {
  const s = ensureInitialized();
  return s.dataset.incidents;
}

/** Get events up to a given time */
export function getEvents(upTo: string, region?: Region): EventPoint[] {
  const s = ensureInitialized();
  const upToMs = new Date(upTo).getTime();

  return s.dataset.events
    .filter((e) => {
      if (new Date(e.timestamp).getTime() > upToMs) return false;
      if (region && e.region && e.region !== region) return false;
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ---------------------------------------------------------------------------
// Pulse Data
// ---------------------------------------------------------------------------

/** Get the overall health status based on active anomalies */
export function getHealthStatus(atTime: string): 'normal' | 'warning' | 'critical' {
  const anomalies = queryAnomalies(atTime);
  const active = anomalies.filter((a) => a.status !== 'resolved');

  if (active.some((a) => a.status === 'critical')) return 'critical';
  if (active.some((a) => a.status === 'active' || a.status === 'forming')) return 'warning';
  return 'normal';
}

/** Get region summaries for pulse view */
export function getRegionSummaries(atTime: string, filterRegion?: Region): RegionSummary[] {
  const regions = filterRegion ? [filterRegion] : [...REGIONS];

  return regions.map((region) => {
    const anomalies = queryAnomalies(atTime, { region });
    const active = anomalies.filter((a) => a.status !== 'resolved');
    const critical = active.filter((a) => a.status === 'critical');

    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (critical.length > 0) status = 'critical';
    else if (active.length > 0) status = 'warning';

    const summary =
      active.length === 0
        ? `${region}: All systems normal`
        : `${region}: ${active.length} active anomal${active.length === 1 ? 'y' : 'ies'}${critical.length > 0 ? ` (${critical.length} critical)` : ''}`;

    return { region, status, activeAnomalies: active.length, summary };
  });
}

/** Get metric summaries with sparkline data */
export function getMetricSummaries(
  atTime: string,
  region?: Region
): MetricSummary[] {
  const s = ensureInitialized();
  const atMs = new Date(atTime).getTime();
  const sparklineMinutes = 30; // last 30 minutes

  const summaries: MetricSummary[] = [];
  const targetRegions = region ? [region] : [...REGIONS];

  for (const metric of METRICS) {
    // Aggregate across target regions
    let totalCurrent = 0;
    let totalPrevious = 0;
    const sparklineValues: number[] = [];
    let count = 0;

    for (const r of targetRegions) {
      const points = s.dataset.metricPoints
        .filter(
          (p) =>
            p.metric === metric &&
            p.region === r &&
            new Date(p.timestamp).getTime() <= atMs
        )
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      if (points.length < 2) continue;

      const latest = points[points.length - 1];
      const previous = points[Math.max(0, points.length - 2)];
      totalCurrent += latest.value;
      totalPrevious += previous.value;
      count++;

      // Build sparkline from last N minutes
      const sparkSlice = points.slice(-sparklineMinutes);
      if (sparklineValues.length === 0) {
        sparkSlice.forEach((p) => sparklineValues.push(p.value));
      } else {
        sparkSlice.forEach((p, i) => {
          if (i < sparklineValues.length) {
            sparklineValues[i] = (sparklineValues[i] + p.value) / 2;
          }
        });
      }
    }

    if (count === 0) continue;

    const avgCurrent = totalCurrent / count;
    const avgPrevious = totalPrevious / count;
    const trendPct = avgPrevious !== 0 ? ((avgCurrent - avgPrevious) / avgPrevious) * 100 : 0;

    summaries.push({
      metric,
      region: region ?? 'all',
      currentValue: Math.round(avgCurrent * 100) / 100,
      trend: trendPct > 1 ? 'up' : trendPct < -1 ? 'down' : 'stable',
      trendPercent: Math.round(trendPct * 10) / 10,
      sparkline: sparklineValues.map((v) => Math.round(v * 100) / 100),
    });
  }

  return summaries;
}

/** Get activity feed entries up to the current time */
export function getActivityFeed(atTime: string, region?: Region): ActivityEntry[] {
  const s = ensureInitialized();
  const atMs = new Date(atTime).getTime();
  const entries: ActivityEntry[] = [];

  // Anomaly state changes
  const anomalies = queryAnomalies(atTime, region ? { region } : undefined);
  for (const anomaly of anomalies) {
    const typeMap: Record<string, ActivityEntry['type']> = {
      forming: 'anomaly_forming',
      active: 'anomaly_active',
      critical: 'anomaly_critical',
      resolved: 'anomaly_resolved',
    };

    entries.push({
      id: `activity-${anomaly.id}`,
      timestamp: anomaly.startTime,
      type: typeMap[anomaly.status] ?? 'anomaly_forming',
      message: `${METRIC_LABELS[anomaly.metric]} in ${anomaly.region}: ${anomaly.status} (severity ${anomaly.severity})`,
      severity: anomaly.severity,
      metric: anomaly.metric,
      region: anomaly.region,
      anomalyId: anomaly.id,
    });
  }

  // Events
  const events = getEvents(atTime, region);
  for (const event of events) {
    entries.push({
      id: `activity-${event.id}`,
      timestamp: event.timestamp,
      type: 'event',
      message: `${event.type === 'deploy' ? '🚀' : event.type === 'promo' ? '📢' : '⚙️'} ${event.label}${event.region ? ` (${event.region})` : ''}`,
      region: event.region ?? undefined,
    });
  }

  // Sort by timestamp descending (most recent first)
  return entries
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// What-Changed
// ---------------------------------------------------------------------------

/** Compare current period vs prior-day baseline */
export function getWhatChanged(
  atTime: string,
  windowPreset: WindowPreset
): WhatChangedEntry[] {
  const s = ensureInitialized();
  const atMs = new Date(atTime).getTime();
  const windowMinutes = windowPreset === '15m' ? 15 : 60;
  const windowMs = windowMinutes * 60 * 1000;

  const entries: WhatChangedEntry[] = [];

  for (const metric of METRICS) {
    for (const region of REGIONS) {
      // Current window average
      const currentPoints = s.dataset.metricPoints.filter((p) => {
        const pMs = new Date(p.timestamp).getTime();
        return (
          p.metric === metric &&
          p.region === region &&
          pMs >= atMs - windowMs &&
          pMs <= atMs
        );
      });

      // Prior-day baseline (same time window, 24h earlier)
      const baselineStart = atMs - 24 * 60 * 60 * 1000 - windowMs;
      const baselineEnd = atMs - 24 * 60 * 60 * 1000;
      // Since our dataset is only 24h, we use the metric baseline
      const baselineValue = METRIC_BASELINES[metric];

      if (currentPoints.length === 0) continue;

      const currentAvg =
        currentPoints.reduce((sum, p) => sum + p.value, 0) / currentPoints.length;
      const pctDelta = percentChangeVsBaseline(currentAvg, baselineValue);

      // A change is "meaningful" if it exceeds 5% from baseline
      const isMeaningful = Math.abs(pctDelta) > 5;

      entries.push({
        metric,
        region,
        currentValue: Math.round(currentAvg * 100) / 100,
        baselineValue,
        percentDelta: Math.round(pctDelta * 10) / 10,
        isMeaningful,
      });
    }
  }

  // Sort: meaningful changes first, then by absolute delta descending
  return entries.sort((a, b) => {
    if (a.isMeaningful !== b.isMeaningful) return a.isMeaningful ? -1 : 1;
    return Math.abs(b.percentDelta) - Math.abs(a.percentDelta);
  });
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/** Get evidence data for a specific signal */
export function getEvidence(
  metric: MetricType,
  region: Region,
  atTime: string
): EvidenceData {
  const s = ensureInitialized();
  const atMs = new Date(atTime).getTime();

  const points = s.dataset.metricPoints
    .filter(
      (p) =>
        p.metric === metric &&
        p.region === region &&
        new Date(p.timestamp).getTime() <= atMs
    )
    .sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  const values = points.map((p) => p.value);
  const baseline = METRIC_BASELINES[metric];

  // Compute stats at the latest point
  const lastIdx = values.length - 1;
  const stats = computeRollingStats(values, lastIdx, baseline);

  // Build chart data with rolling mean and bands
  const means = rollingMean(values, DEFAULT_ROLLING_WINDOW);
  const stdDevs = rollingStdDev(values, DEFAULT_ROLLING_WINDOW);

  // Last 60 points for the chart
  const chartStart = Math.max(0, points.length - 60);
  const chartData: EvidenceChartPoint[] = points.slice(chartStart).map((p, i) => {
    const idx = chartStart + i;
    const mean = isNaN(means[idx]) ? baseline : means[idx];
    const sd = isNaN(stdDevs[idx]) ? 0 : stdDevs[idx];
    return {
      timestamp: p.timestamp,
      value: Math.round(p.value * 100) / 100,
      rollingMean: Math.round(mean * 100) / 100,
      upperBand: Math.round((mean + sd) * 100) / 100,
      lowerBand: Math.round((mean - sd) * 100) / 100,
    };
  });

  // Evaluate criteria
  const z = Math.abs(stats.zScore);
  const roc = Math.abs(stats.rateOfChange);
  const pctBaseline = Math.abs(stats.percentChangeVsBaseline);

  const criteriaResults = [
    { name: 'Z-Score > 3.0', met: z > 3.0, value: Math.round(z * 100) / 100, threshold: 3.0 },
    {
      name: 'Rate of Change',
      met: roc > 10,
      value: Math.round(roc * 100) / 100,
      threshold: 10,
    },
    {
      name: 'Baseline Deviation',
      met: pctBaseline > 20,
      value: Math.round(pctBaseline * 10) / 10,
      threshold: 20,
    },
  ];

  return {
    signalId: `${metric}-${region}`,
    metric,
    region,
    currentValue: Math.round(values[lastIdx] * 100) / 100,
    stats: {
      mean: Math.round(stats.mean * 100) / 100,
      stdDev: Math.round(stats.stdDev * 100) / 100,
      zScore: Math.round(stats.zScore * 100) / 100,
      percentChange: Math.round(stats.percentChange * 10) / 10,
      percentChangeVsBaseline: Math.round(stats.percentChangeVsBaseline * 10) / 10,
      rateOfChange: Math.round(stats.rateOfChange * 100) / 100,
    },
    criteriaResults,
    chartData,
  };
}

// ---------------------------------------------------------------------------
// Cascade
// ---------------------------------------------------------------------------

/** Get cascade state for an incident at a specific time */
export function queryCascadeState(
  incidentId: string,
  atTime: string
): CascadeState | null {
  const s = ensureInitialized();
  const incident = s.dataset.incidents.find((i) => i.id === incidentId);
  if (!incident) return null;

  return getCascadeState(s.dataset.metricPoints, s.anomalies, incident, atTime);
}

// ---------------------------------------------------------------------------
// Insight
// ---------------------------------------------------------------------------

/** Get insight for an incident */
export function queryInsight(incidentId: string): Insight | null {
  const s = ensureInitialized();
  const incident = s.dataset.incidents.find((i) => i.id === incidentId);
  if (!incident) return null;

  const provider = getInsightProvider();
  return provider.generate(incident, s.anomalies, s.dataset.metricPoints);
}

// ---------------------------------------------------------------------------
// Store Info
// ---------------------------------------------------------------------------

export function getCurrentScenarioId(): string {
  const s = ensureInitialized();
  return s.dataset.scenarioId;
}

export function getAllAnomalies(): Anomaly[] {
  const s = ensureInitialized();
  return s.anomalies;
}
