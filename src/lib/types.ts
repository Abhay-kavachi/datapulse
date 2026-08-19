// ============================================================================
// DataPulse — Core Type Definitions
// All types, enums, and allow-lists used across the application.
// ============================================================================

// ---------------------------------------------------------------------------
// Enums (also serve as allow-lists for input validation)
// ---------------------------------------------------------------------------

export const METRICS = [
  'traffic',
  'checkout_latency_ms',
  'payment_failure_rate',
  'conversion_rate',
  'error_rate',
  'revenue_index',
] as const;

export type MetricType = (typeof METRICS)[number];

export const REGIONS = ['NA', 'EU', 'APAC', 'LATAM'] as const;
export type Region = (typeof REGIONS)[number];

export const ANOMALY_STATUSES = ['forming', 'active', 'critical', 'resolved'] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

export const EVENT_TYPES = ['deploy', 'promo', 'config_change', 'external_note'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PLAYBACK_SPEEDS = [1, 4, 30] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const WINDOW_PRESETS = ['15m', '60m'] as const;
export type WindowPreset = (typeof WINDOW_PRESETS)[number];

// ---------------------------------------------------------------------------
// Data Entities
// ---------------------------------------------------------------------------

export interface MetricPoint {
  id: string;
  timestamp: string; // ISO 8601
  metric: MetricType;
  region: Region;
  value: number;
}

export interface EventPoint {
  id: string;
  timestamp: string; // ISO 8601
  type: EventType;
  region: Region | null;
  label: string;
}

export interface Anomaly {
  id: string;
  metric: MetricType;
  region: Region;
  startTime: string;
  endTime: string | null; // null while ongoing
  severity: number; // 0-100
  confidence: number; // 0-100
  status: AnomalyStatus;
  triggeringCriteria: string[];
}

export interface IncidentStage {
  timestamp: string;
  metric: MetricType;
  description: string;
}

export interface Incident {
  id: string;
  label: string;
  region: Region;
  stages: IncidentStage[];
  anomalyIds: string[];
}

// ---------------------------------------------------------------------------
// Cascade / Graph
// ---------------------------------------------------------------------------

export interface CascadeEdge {
  from: MetricType;
  to: MetricType;
  correlationScore: number;
  lagMinutes: number;
  label: string; // Always "correlated", never "caused"
}

export type CascadeNodeStatus = 'inactive' | 'forming' | 'active' | 'critical' | 'resolved';

export interface CascadeNode {
  metric: MetricType;
  status: CascadeNodeStatus;
  value: number;
  baseline: number;
  percentChange: number;
  timestamp: string;
}

export interface CascadeState {
  incidentId: string;
  nodes: CascadeNode[];
  edges: CascadeEdge[];
  currentTime: string;
}

// ---------------------------------------------------------------------------
// Analytics / Evidence
// ---------------------------------------------------------------------------

export interface RollingStats {
  mean: number;
  stdDev: number;
  zScore: number;
  percentChange: number;
  percentChangeVsBaseline: number;
  rateOfChange: number;
}

export interface EvidenceData {
  signalId: string;
  metric: MetricType;
  region: Region;
  currentValue: number;
  stats: RollingStats;
  criteriaResults: CriterionResult[];
  chartData: EvidenceChartPoint[];
}

export interface CriterionResult {
  name: string;
  met: boolean;
  value: number;
  threshold: number;
}

export interface EvidenceChartPoint {
  timestamp: string;
  value: number;
  rollingMean: number;
  upperBand: number; // mean + stddev
  lowerBand: number; // mean - stddev
}

// ---------------------------------------------------------------------------
// Insight
// ---------------------------------------------------------------------------

export interface Insight {
  incidentId: string;
  summary: string;
  provider: 'deterministic' | 'llm';
  providerLabel: string;
  claims: InsightClaim[];
}

export interface InsightClaim {
  text: string;
  metric: MetricType;
  signalId: string;
  evidenceLink: string;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface PulseResponse {
  health: 'normal' | 'warning' | 'critical';
  regions: RegionSummary[];
  metrics: MetricSummary[];
  activityFeed: ActivityEntry[];
  currentTime: string;
}

export interface RegionSummary {
  region: Region;
  status: 'normal' | 'warning' | 'critical';
  activeAnomalies: number;
  summary: string;
}

export interface MetricSummary {
  metric: MetricType;
  region: Region | 'all';
  currentValue: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  sparkline: number[];
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: 'anomaly_forming' | 'anomaly_active' | 'anomaly_critical' | 'anomaly_resolved' | 'event';
  message: string;
  severity?: number;
  metric?: MetricType;
  region?: Region;
  anomalyId?: string;
}

export interface WhatChangedEntry {
  metric: MetricType;
  region: Region;
  currentValue: number;
  baselineValue: number;
  percentDelta: number;
  isMeaningful: boolean;
}

// ---------------------------------------------------------------------------
// Scenario (P1-A: Multiple Scenarios)
// ---------------------------------------------------------------------------

export interface Scenario {
  id: string;
  name: string;
  description: string;
  timeRange: { start: string; end: string };
  incidentConfig: IncidentConfig;
}

export interface IncidentConfig {
  region: Region;
  label: string;
  stages: IncidentStageConfig[];
}

export interface IncidentStageConfig {
  offsetMinutes: number; // from incident start
  metric: MetricType;
  description: string;
  deltaFn: 'spike' | 'gradual_rise' | 'gradual_fall' | 'elevated';
  magnitude: number; // multiplier over baseline
}

// ---------------------------------------------------------------------------
// Metric Display Metadata
// ---------------------------------------------------------------------------

export const METRIC_LABELS: Record<MetricType, string> = {
  traffic: 'Traffic',
  checkout_latency_ms: 'Checkout Latency',
  payment_failure_rate: 'Payment Failure Rate',
  conversion_rate: 'Conversion Rate',
  error_rate: 'Error Rate',
  revenue_index: 'Revenue Index',
};

export const METRIC_UNITS: Record<MetricType, string> = {
  traffic: 'req/s',
  checkout_latency_ms: 'ms',
  payment_failure_rate: '%',
  conversion_rate: '%',
  error_rate: '%',
  revenue_index: 'index',
};

export const METRIC_BASELINES: Record<MetricType, number> = {
  traffic: 1000,
  checkout_latency_ms: 310,
  payment_failure_rate: 2.1,
  conversion_rate: 3.2,
  error_rate: 0.5,
  revenue_index: 100,
};

/** Higher-is-worse metrics flip the anomaly direction */
export const METRIC_HIGHER_IS_WORSE: Record<MetricType, boolean> = {
  traffic: false, // higher traffic is not inherently bad
  checkout_latency_ms: true,
  payment_failure_rate: true,
  conversion_rate: false, // lower conversion is bad
  error_rate: true,
  revenue_index: false,
};
