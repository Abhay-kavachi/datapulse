// ============================================================================
// DataPulse — Synthetic Data Generator
// Generates a deterministic dataset for a given scenario.
// ============================================================================

import type { MetricPoint, EventPoint, Incident } from '@/lib/types';
import { METRICS, REGIONS, METRIC_BASELINES } from '@/lib/types';
import { createPRNG, gaussianRandom } from '@/lib/data/prng';
import { SCENARIOS, DEFAULT_SCENARIO_ID, DATASET_START, DATASET_SEED, getIncidentStartTime } from '@/lib/data/scenarios';

export interface GeneratedDataset {
  metricPoints: MetricPoint[];
  events: EventPoint[];
  incidents: Incident[];
  seed: number;
  scenarioId: string;
}

/**
 * Generates a deterministic dataset for a specific scenario.
 * Evaluates exactly 24 hours of data at 1-minute resolution.
 * 
 * @param scenarioId - The ID of the scenario to simulate.
 * @returns A fully generated dataset with metric points, events, and incident ground truth.
 */
export function generateDataset(scenarioId: string): GeneratedDataset {
  const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS.find(s => s.id === DEFAULT_SCENARIO_ID)!;
  const rng = createPRNG(DATASET_SEED);
  
  const metricPoints: MetricPoint[] = [];
  const events: EventPoint[] = [];
  
  const datasetStart = new Date(DATASET_START);
  const incidentStart = getIncidentStartTime(scenario);
  const incidentStartMinute = Math.floor((incidentStart.getTime() - datasetStart.getTime()) / 60000);
  
  const stages = scenario.incidentConfig.stages;
  // The recovery sentinel is the last stage (magnitude 0.0)
  const recoveryStage = stages[stages.length - 1];
  const recoveryStartMinute = incidentStartMinute + (recoveryStage ? recoveryStage.offsetMinutes : 9999);
  
  for (let minuteIndex = 0; minuteIndex < 1440; minuteIndex++) {
    const timestamp = new Date(datasetStart.getTime() + minuteIndex * 60000).toISOString();
    const h = minuteIndex / 60;
    
    // Seasonal multiplier (peaks at 16:00, trough at 04:00)
    const trafficMultiplier = 1.0 + 0.3 * Math.sin(((h - 10) / 24) * 2 * Math.PI);
    
    for (const region of REGIONS) {
      for (const metric of METRICS) {
        const baseline = METRIC_BASELINES[metric];
        let seasonalMult = 1.0;
        
        if (metric === 'traffic') {
          seasonalMult = trafficMultiplier;
        } else if (metric === 'checkout_latency_ms') {
          // Latency correlates slightly with traffic volume
          seasonalMult = 1.0 + (trafficMultiplier - 1.0) * 0.2;
        }
        
        // normally within ~5% of baseline
        const noiseLevel = (baseline * 0.05) / 3;
        const noise = gaussianRandom(rng, 0, noiseLevel);
        
        let multiplier = 1.0;
        
        if (region === scenario.incidentConfig.region) {
          const stage = stages.find(s => s.metric === metric && s.magnitude !== 0);
          if (stage) {
            const onsetMinute = incidentStartMinute + stage.offsetMinutes;
            if (minuteIndex >= onsetMinute) {
              if (minuteIndex < recoveryStartMinute) {
                if (stage.deltaFn === 'spike' || stage.deltaFn === 'elevated') {
                  multiplier = stage.magnitude;
                } else if (stage.deltaFn === 'gradual_rise' || stage.deltaFn === 'gradual_fall') {
                  const progress = Math.min(1, (minuteIndex - onsetMinute) / 5.0);
                  multiplier = 1.0 + (stage.magnitude - 1.0) * progress;
                }
              } else {
                // Recovery phase over ~30 minutes
                const maxMultiplier = stage.magnitude;
                const progress = Math.min(1, (minuteIndex - recoveryStartMinute) / 30.0);
                multiplier = maxMultiplier + (1.0 - maxMultiplier) * progress;
              }
            }
          }
        }
        
        let euBlip = 0;
        if (region === 'EU' && metric === 'checkout_latency_ms' && minuteIndex >= 1005 && minuteIndex <= 1015) {
          // A sine wave bump over 10 minutes peaking at 10ms.
          euBlip = 10 * Math.sin(((minuteIndex - 1005) / 10) * Math.PI);
        }
        
        let value = baseline * seasonalMult * multiplier + noise + euBlip;
        
        // Ensure values make physical sense
        if (metric === 'checkout_latency_ms') {
          value = Math.max(1, value);
        } else {
          value = Math.max(0, value);
        }
        
        metricPoints.push({
          id: `${metric}-${region}-${minuteIndex}`,
          timestamp,
          metric,
          region,
          value
        });
      }
    }
  }
  
  // Events
  events.push({
    id: 'evt-deploy-1',
    timestamp: new Date(datasetStart.getTime() + 8 * 60 * 60000).toISOString(),
    type: 'deploy',
    region: null,
    label: 'Backend Service v2.1.4'
  });
  
  events.push({
    id: 'evt-config-1',
    timestamp: new Date(datasetStart.getTime() + 14 * 60 * 60000).toISOString(),
    type: 'config_change',
    region: 'APAC',
    label: 'Routing Rule Update'
  });
  
  events.push({
    id: 'evt-promo-1',
    timestamp: new Date(datasetStart.getTime() + 18 * 60 * 60000).toISOString(),
    type: 'promo',
    region: 'EU',
    label: 'Flash Sale (EU)'
  });
  
  const incidents: Incident[] = [{
    id: `inc-${scenario.id}`,
    label: scenario.incidentConfig.label,
    region: scenario.incidentConfig.region,
    stages: stages.map(s => ({
      timestamp: new Date(incidentStart.getTime() + s.offsetMinutes * 60000).toISOString(),
      metric: s.metric,
      description: s.description
    })),
    anomalyIds: []
  }];
  
  return {
    metricPoints,
    events,
    incidents,
    seed: DATASET_SEED,
    scenarioId: scenario.id
  };
}
