import { describe, it, expect } from 'vitest';
import { detectAnomalies } from './detector';
import { MetricPoint } from '@/lib/types';
import { DATASET_START } from '@/lib/data/scenarios';

describe('Anomaly Detector', () => {
  it('does not flag normal data', () => {
    // Generate 30 minutes of normal traffic data
    const points: MetricPoint[] = [];
    const baseTime = new Date(DATASET_START).getTime();
    
    for (let i = 0; i < 30; i++) {
      points.push({
        id: `traffic-APAC-${i}`,
        timestamp: new Date(baseTime + i * 60000).toISOString(),
        metric: 'traffic',
        region: 'APAC',
        value: 1000 + (Math.random() * 50 - 25) // Baseline 1000, +/- 2.5% noise
      });
    }

    const upToTime = points[29].timestamp;
    const anomalies = detectAnomalies(points, upToTime, []);
    
    expect(anomalies.length).toBe(0);
  });

  it('flags anomaly when z-score and baseline deviation agree (spike)', () => {
    const points: MetricPoint[] = [];
    const baseTime = new Date(DATASET_START).getTime();
    
    // 20 minutes normal
    for (let i = 0; i < 20; i++) {
      points.push({
        id: `traffic-APAC-${i}`,
        timestamp: new Date(baseTime + i * 60000).toISOString(),
        metric: 'traffic',
        region: 'APAC',
        value: 1000 + (Math.random() * 10 - 5)
      });
    }

    // 1 minute massive spike
    points.push({
      id: `traffic-APAC-20`,
      timestamp: new Date(baseTime + 20 * 60000).toISOString(),
      metric: 'traffic',
      region: 'APAC',
      value: 1800 // +80% vs baseline
    });

    const upToTime = points[20].timestamp;
    const anomalies = detectAnomalies(points, upToTime, []);
    
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].metric).toBe('traffic');
    expect(anomalies[0].region).toBe('APAC');
    expect(anomalies[0].status).not.toBe('resolved');
  });

  it('does not flag if only one criterion is met (EU blip scenario)', () => {
    const points: MetricPoint[] = [];
    const baseTime = new Date(DATASET_START).getTime();
    
    // 20 minutes normal latency
    for (let i = 0; i < 20; i++) {
      points.push({
        id: `latency-EU-${i}`,
        timestamp: new Date(baseTime + i * 60000).toISOString(),
        metric: 'checkout_latency_ms',
        region: 'EU',
        value: 310 + (Math.random() * 4 - 2) // 310ms baseline, very tight variance
      });
    }

    // 1 minute slight bump (causes high z-score due to tight variance, but low absolute delta)
    points.push({
      id: `latency-EU-20`,
      timestamp: new Date(baseTime + 20 * 60000).toISOString(),
      metric: 'checkout_latency_ms',
      region: 'EU',
      value: 330 // Not >25% baseline threshold, ROC likely won't hit 15. Only Z-score triggers.
    });

    const upToTime = points[20].timestamp;
    const anomalies = detectAnomalies(points, upToTime, []);
    
    expect(anomalies.length).toBe(0); // Multi-criteria saves the day!
  });
});
