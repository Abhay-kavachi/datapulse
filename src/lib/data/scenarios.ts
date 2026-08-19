// ============================================================================
// DataPulse — Scenario Definitions
// Each scenario uses the SAME analytics engine. Only the incident injection
// differs. This demonstrates reusable engineering to prospective clients.
// ============================================================================

import type { Scenario } from '@/lib/types';

/** The dataset always starts at midnight and spans 24 hours */
export const DATASET_START = '2024-01-15T00:00:00Z';
export const DATASET_END = '2024-01-15T23:59:00Z';
export const DATASET_SEED = 42;

export const SCENARIOS: Scenario[] = [
  {
    id: 'apac-checkout',
    name: 'APAC Checkout Incident',
    description:
      'A traffic spike in APAC cascades through checkout latency, payment failures, and conversion — the classic operational cascade.',
    timeRange: { start: '2024-01-15T14:15:00Z', end: '2024-01-15T15:20:00Z' },
    incidentConfig: {
      region: 'APAC',
      label: 'APAC Checkout Cascade',
      stages: [
        {
          offsetMinutes: 0,  // 14:25
          metric: 'traffic',
          description: 'Traffic spike begins',
          deltaFn: 'spike',
          magnitude: 1.8,
        },
        {
          offsetMinutes: 3,  // 14:28
          metric: 'checkout_latency_ms',
          description: 'Checkout latency increases',
          deltaFn: 'gradual_rise',
          magnitude: 1.35,
        },
        {
          offsetMinutes: 7,  // 14:32
          metric: 'payment_failure_rate',
          description: 'Payment failures increase',
          deltaFn: 'gradual_rise',
          magnitude: 2.5,
        },
        {
          offsetMinutes: 10, // 14:35
          metric: 'conversion_rate',
          description: 'Conversion rate falls',
          deltaFn: 'gradual_fall',
          magnitude: 0.7,
        },
        {
          offsetMinutes: 15, // 14:40
          metric: 'error_rate',
          description: 'Error rate escalates — incident critical',
          deltaFn: 'gradual_rise',
          magnitude: 3.0,
        },
        {
          offsetMinutes: 45, // 15:10
          metric: 'traffic',
          description: 'Signals begin recovering',
          deltaFn: 'spike',
          magnitude: 0.0, // sentinel: triggers recovery
        },
      ],
    },
  },
  {
    id: 'infra-degradation',
    name: 'Infrastructure Degradation',
    description:
      'Database query latency creeps up, causing timeouts and a rising error rate — a slow-burn infrastructure incident.',
    timeRange: { start: '2024-01-15T09:45:00Z', end: '2024-01-15T11:00:00Z' },
    incidentConfig: {
      region: 'NA',
      label: 'NA Infrastructure Degradation',
      stages: [
        {
          offsetMinutes: 0,  // 10:00
          metric: 'checkout_latency_ms',
          description: 'Query latency begins rising',
          deltaFn: 'gradual_rise',
          magnitude: 1.6,
        },
        {
          offsetMinutes: 5,  // 10:05
          metric: 'error_rate',
          description: 'Timeout errors increase',
          deltaFn: 'gradual_rise',
          magnitude: 4.0,
        },
        {
          offsetMinutes: 10, // 10:10
          metric: 'payment_failure_rate',
          description: 'Payment processing affected',
          deltaFn: 'gradual_rise',
          magnitude: 2.0,
        },
        {
          offsetMinutes: 15, // 10:15
          metric: 'conversion_rate',
          description: 'Conversion drops from errors',
          deltaFn: 'gradual_fall',
          magnitude: 0.75,
        },
        {
          offsetMinutes: 20, // 10:20
          metric: 'revenue_index',
          description: 'Revenue impact observed',
          deltaFn: 'gradual_fall',
          magnitude: 0.8,
        },
        {
          offsetMinutes: 50, // 10:50
          metric: 'checkout_latency_ms',
          description: 'Recovery begins',
          deltaFn: 'spike',
          magnitude: 0.0,
        },
      ],
    },
  },
  {
    id: 'traffic-surge',
    name: 'Regional Traffic Surge',
    description:
      'A sudden surge in EU traffic pushes capacity limits, causing latency spikes and degraded user experience.',
    timeRange: { start: '2024-01-15T18:45:00Z', end: '2024-01-15T20:00:00Z' },
    incidentConfig: {
      region: 'EU',
      label: 'EU Traffic Surge',
      stages: [
        {
          offsetMinutes: 0,  // 19:00
          metric: 'traffic',
          description: 'Traffic surge begins',
          deltaFn: 'spike',
          magnitude: 2.2,
        },
        {
          offsetMinutes: 4,  // 19:04
          metric: 'checkout_latency_ms',
          description: 'Latency rises under load',
          deltaFn: 'gradual_rise',
          magnitude: 1.5,
        },
        {
          offsetMinutes: 8,  // 19:08
          metric: 'error_rate',
          description: 'Error rate climbs',
          deltaFn: 'gradual_rise',
          magnitude: 3.5,
        },
        {
          offsetMinutes: 12, // 19:12
          metric: 'conversion_rate',
          description: 'Conversion degrades',
          deltaFn: 'gradual_fall',
          magnitude: 0.72,
        },
        {
          offsetMinutes: 40, // 19:40
          metric: 'traffic',
          description: 'Traffic normalizes',
          deltaFn: 'spike',
          magnitude: 0.0,
        },
      ],
    },
  },
];

export const DEFAULT_SCENARIO_ID = 'apac-checkout';

/** Get the incident start time for a scenario's configured start */
export function getIncidentStartTime(scenario: Scenario): Date {
  // The incident starts at the scenario time range start + 10 minutes
  // (to have some pre-incident baseline visible)
  const rangeStart = new Date(scenario.timeRange.start);
  return new Date(rangeStart.getTime() + 10 * 60 * 1000);
}
