// ============================================================================
// DataPulse — Anomaly Detector
// Multi-criteria detection: flags when ≥2 of 3 criteria independently agree.
// ============================================================================

import type {
  MetricPoint,
  MetricType,
  Region,
  Anomaly,
  AnomalyStatus,
  CriterionResult,
} from '@/lib/types';
import { METRICS, REGIONS, METRIC_BASELINES, METRIC_HIGHER_IS_WORSE } from '@/lib/types';
import {
  rollingMean,
  rollingStdDev,
  zScore,
  rateOfChange,
  percentChangeVsBaseline,
} from '@/lib/analytics/engine';

// ---------------------------------------------------------------------------
// Thresholds (named constants, not magic numbers)
// ---------------------------------------------------------------------------

/** Z-score threshold: flag if |z| exceeds this */
const Z_SCORE_THRESHOLD = 3.0;

/** Per-metric rate-of-change thresholds (slope per minute) */
const ROC_THRESHOLDS: Record<MetricType, number> = {
  traffic: 50,
  checkout_latency_ms: 15,
  payment_failure_rate: 0.3,
  conversion_rate: 0.15,
  error_rate: 0.1,
  revenue_index: 2,
};

/** Per-metric baseline percentage-change thresholds */
const BASELINE_PCT_THRESHOLDS: Record<MetricType, number> = {
  traffic: 40,
  checkout_latency_ms: 25,
  payment_failure_rate: 50,
  conversion_rate: 20,
  error_rate: 80,
  revenue_index: 15,
};

const ROLLING_WINDOW = 15; // minutes
const ROC_WINDOW = 5; // minutes
const MIN_CRITERIA_COUNT = 2; // ≥2 of 3 must agree

// Severity weights
const SEVERITY_Z_WEIGHT = 0.4;
const SEVERITY_ROC_WEIGHT = 0.3;
const SEVERITY_BASELINE_WEIGHT = 0.3;

// Confidence base per criteria count
const CONFIDENCE_BASE: Record<number, number> = {
  0: 0,
  1: 30,
  2: 65,
  3: 90,
};

const CORRELATION_CONFIDENCE_BOOST = 8; // boost when upstream is also anomalous

// ---------------------------------------------------------------------------
// Severity status thresholds
// ---------------------------------------------------------------------------

const STATUS_THRESHOLDS = {
  forming: 20,
  active: 45,
  critical: 70,
} as const;

/**
 * Detect anomalies across all metrics and regions up to a given time.
 * Returns independently-computed Anomaly[] — not hardcoded to any scenario.
 */
export function detectAnomalies(
  metricPoints: MetricPoint[],
  upToTime: string,
  existingAnomalies: Anomaly[] = []
): Anomaly[] {
  const upToMs = new Date(upToTime).getTime();
  const anomalies: Anomaly[] = [...existingAnomalies];

  for (const region of REGIONS) {
    for (const metric of METRICS) {
      // Get all points for this metric+region up to current time, sorted by timestamp
      const series = metricPoints
        .filter(
          (p) =>
            p.metric === metric &&
            p.region === region &&
            new Date(p.timestamp).getTime() <= upToMs
        )
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (series.length < ROLLING_WINDOW + 1) continue;

      const values = series.map((p) => p.value);
      const means = rollingMean(values, ROLLING_WINDOW);
      const stdDevs = rollingStdDev(values, ROLLING_WINDOW);

      // Check the latest point
      const lastIdx = values.length - 1;
      const currentValue = values[lastIdx];
      const currentMean = means[lastIdx];
      const currentStdDev = stdDevs[lastIdx];
      const currentTimestamp = series[lastIdx].timestamp;

      if (isNaN(currentMean) || isNaN(currentStdDev)) continue;

      // Evaluate the three criteria
      const criteria = evaluateCriteria(
        currentValue,
        currentMean,
        currentStdDev,
        values,
        metric,
        lastIdx
      );

      const metCount = criteria.filter((c) => c.met).length;
      const isAnomalous = metCount >= MIN_CRITERIA_COUNT;

      // Find existing anomaly for this metric+region
      const existingIdx = anomalies.findIndex(
        (a) => a.metric === metric && a.region === region && a.status !== 'resolved'
      );

      if (isAnomalous) {
        const severity = computeSeverity(criteria, metric, currentValue);
        const status = computeStatus(severity);

        // Check if upstream signal is also anomalous (for confidence boost)
        const hasUpstreamAnomaly = checkUpstreamAnomaly(anomalies, metric, region);
        const confidence = computeConfidence(metCount, hasUpstreamAnomaly);

        if (existingIdx >= 0) {
          // Update existing anomaly
          anomalies[existingIdx] = {
            ...anomalies[existingIdx],
            severity,
            confidence,
            status,
            triggeringCriteria: criteria.filter((c) => c.met).map((c) => c.name),
          };
        } else {
          // Create new anomaly
          anomalies.push({
            id: `anomaly-${metric}-${region}-${currentTimestamp}`,
            metric,
            region,
            startTime: currentTimestamp,
            endTime: null,
            severity,
            confidence,
            status,
            triggeringCriteria: criteria.filter((c) => c.met).map((c) => c.name),
          });
        }
      } else if (existingIdx >= 0 && anomalies[existingIdx].status !== 'resolved') {
        // Signal returned to normal — resolve the anomaly
        anomalies[existingIdx] = {
          ...anomalies[existingIdx],
          status: 'resolved',
          endTime: currentTimestamp,
          severity: Math.max(0, anomalies[existingIdx].severity - 10),
        };
      }
    }
  }

  return anomalies;
}

/**
 * Run full anomaly detection across the entire dataset, processing minute by minute.
 * Returns the complete anomaly timeline.
 */
export function detectAllAnomalies(metricPoints: MetricPoint[]): Anomaly[] {
  // Get all unique timestamps, sorted
  const timestamps = [...new Set(metricPoints.map((p) => p.timestamp))].sort();

  let anomalies: Anomaly[] = [];

  // Process at 5-minute intervals for efficiency (detection window is 15 min)
  for (let i = ROLLING_WINDOW; i < timestamps.length; i += 5) {
    anomalies = detectAnomalies(metricPoints, timestamps[i], anomalies);
  }

  // Final pass at the last timestamp
  anomalies = detectAnomalies(
    metricPoints,
    timestamps[timestamps.length - 1],
    anomalies
  );

  return anomalies;
}

/**
 * Get anomalies visible at a specific point in time.
 */
export function getAnomaliesAtTime(
  allAnomalies: Anomaly[],
  atTime: string,
  filters?: {
    region?: Region;
    metric?: MetricType;
    status?: AnomalyStatus;
    minSeverity?: number;
  }
): Anomaly[] {
  const atMs = new Date(atTime).getTime();

  return allAnomalies.filter((a) => {
    const startMs = new Date(a.startTime).getTime();
    const endMs = a.endTime ? new Date(a.endTime).getTime() : Infinity;

    // Must have started by this time
    if (startMs > atMs) return false;
    // If resolved, still show for some time after resolution
    if (endMs < atMs - 30 * 60 * 1000) return false;

    // Apply filters
    if (filters?.region && a.region !== filters.region) return false;
    if (filters?.metric && a.metric !== filters.metric) return false;
    if (filters?.status && a.status !== filters.status) return false;
    if (filters?.minSeverity && a.severity < filters.minSeverity) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function evaluateCriteria(
  currentValue: number,
  mean: number,
  stdDev: number,
  values: number[],
  metric: MetricType,
  index: number
): CriterionResult[] {
  const z = zScore(currentValue, mean, stdDev);
  const absZ = Math.abs(z);

  const roc = index >= ROC_WINDOW ? Math.abs(rateOfChange(values.slice(0, index + 1), ROC_WINDOW)) : 0;

  const baseline = METRIC_BASELINES[metric];
  const pctVsBaseline = Math.abs(percentChangeVsBaseline(currentValue, baseline));

  return [
    {
      name: `z-score>${Z_SCORE_THRESHOLD.toFixed(1)}`,
      met: absZ > Z_SCORE_THRESHOLD,
      value: absZ,
      threshold: Z_SCORE_THRESHOLD,
    },
    {
      name: `rate-of-change>${ROC_THRESHOLDS[metric]}`,
      met: roc > ROC_THRESHOLDS[metric],
      value: roc,
      threshold: ROC_THRESHOLDS[metric],
    },
    {
      name: `baseline-deviation>${BASELINE_PCT_THRESHOLDS[metric]}%`,
      met: pctVsBaseline > BASELINE_PCT_THRESHOLDS[metric],
      value: pctVsBaseline,
      threshold: BASELINE_PCT_THRESHOLDS[metric],
    },
  ];
}

function computeSeverity(
  criteria: CriterionResult[],
  metric: MetricType,
  _currentValue: number
): number {
  // Weighted combination of how far each criterion exceeds its threshold
  const zExcess = Math.max(0, (criteria[0].value - criteria[0].threshold) / criteria[0].threshold);
  const rocExcess = Math.max(0, (criteria[1].value - criteria[1].threshold) / criteria[1].threshold);
  const baselineExcess = Math.max(
    0,
    (criteria[2].value - criteria[2].threshold) / criteria[2].threshold
  );

  const raw =
    zExcess * SEVERITY_Z_WEIGHT +
    rocExcess * SEVERITY_ROC_WEIGHT +
    baselineExcess * SEVERITY_BASELINE_WEIGHT;

  // Scale to 0-100
  return Math.min(100, Math.round(raw * 50 + 30));
}

function computeStatus(severity: number): AnomalyStatus {
  if (severity >= STATUS_THRESHOLDS.critical) return 'critical';
  if (severity >= STATUS_THRESHOLDS.active) return 'active';
  if (severity >= STATUS_THRESHOLDS.forming) return 'forming';
  return 'forming';
}

function computeConfidence(criteriaMetCount: number, hasUpstreamAnomaly: boolean): number {
  const base = CONFIDENCE_BASE[criteriaMetCount] ?? 0;
  const boost = hasUpstreamAnomaly ? CORRELATION_CONFIDENCE_BOOST : 0;
  return Math.min(100, base + boost);
}

/** Check if a known upstream signal in the cascade order is also anomalous */
function checkUpstreamAnomaly(
  anomalies: Anomaly[],
  metric: MetricType,
  region: Region
): boolean {
  // Cascade order: traffic → latency → payment_failure → conversion → error → revenue
  const cascadeOrder: MetricType[] = [
    'traffic',
    'checkout_latency_ms',
    'payment_failure_rate',
    'conversion_rate',
    'error_rate',
    'revenue_index',
  ];

  const myIdx = cascadeOrder.indexOf(metric);
  if (myIdx <= 0) return false;

  // Check if any upstream signal in the same region is currently anomalous
  for (let i = 0; i < myIdx; i++) {
    const upstream = anomalies.find(
      (a) =>
        a.metric === cascadeOrder[i] &&
        a.region === region &&
        a.status !== 'resolved'
    );
    if (upstream) return true;
  }

  return false;
}
