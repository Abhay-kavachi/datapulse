import { RollingStats } from '@/lib/types';

export const DEFAULT_ROLLING_WINDOW = 15;
export const DEFAULT_ROC_WINDOW = 5;

/**
 * Compute rolling mean over a window of `windowSize` points.
 * Returns NaN if insufficient data.
 * 
 * @param values - Array of numerical values.
 * @param windowSize - The size of the rolling window.
 * @returns An array of rolling means.
 */
export function rollingMean(values: number[], windowSize: number): number[] {
  return values.map((_, i) => {
    if (i < windowSize - 1) return NaN;
    let sum = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      sum += values[j];
    }
    return sum / windowSize;
  });
}

/**
 * Compute rolling standard deviation over a window of `windowSize` points.
 * Uses population stddev (N divisor, not N-1) for consistency.
 * Returns NaN if insufficient data.
 * 
 * @param values - Array of numerical values.
 * @param windowSize - The size of the rolling window.
 * @returns An array of rolling standard deviations.
 */
export function rollingStdDev(values: number[], windowSize: number): number[] {
  const means = rollingMean(values, windowSize);
  return values.map((_, i) => {
    if (i < windowSize - 1 || isNaN(means[i])) return NaN;
    let sumSq = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      sumSq += Math.pow(values[j] - means[i], 2);
    }
    return Math.sqrt(sumSq / windowSize);
  });
}

/**
 * Compute z-score: (current - mean) / stdDev.
 * Returns 0 if stdDev is 0 or NaN.
 * 
 * @param current - The current value.
 * @param mean - The mean of the distribution.
 * @param stdDev - The standard deviation of the distribution.
 * @returns The computed z-score.
 */
export function zScore(current: number, mean: number, stdDev: number): number {
  if (!stdDev || isNaN(stdDev)) return 0;
  return (current - mean) / stdDev;
}

/**
 * Percentage change between current and previous values.
 * Returns 0 if previous is 0.
 * 
 * @param current - The current value.
 * @param previous - The previous value.
 * @returns The percentage change.
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Percentage change vs a prior-day baseline value.
 * Returns 0 if baseline is 0.
 * 
 * @param current - The current value.
 * @param baseline - The baseline value.
 * @returns The percentage change against the baseline.
 */
export function percentChangeVsBaseline(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

/**
 * Rate of change (slope) over the trailing `windowSize` points.
 * Uses simple linear regression slope.
 * Catches fast-forming spikes before z-score alone would.
 * Returns NaN if insufficient data.
 * 
 * @param values - Array of numerical values up to the current point.
 * @param windowSize - The size of the window to compute slope.
 * @returns The rate of change (slope).
 */
export function rateOfChange(values: number[], windowSize: number): number {
  if (values.length < windowSize) return NaN;
  
  const n = windowSize;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  const startIndex = values.length - windowSize;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[startIndex + i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;
  
  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Computes Pearson correlation coefficient between two equal length series.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Bounded cross-correlation between two equal-length series
 * within a 0 to maxLagMinutes lag window.
 * Returns the maximum correlation score and optimal lag.
 * Used to propose cascade edges.
 * 
 * @param seriesA - The leading series.
 * @param seriesB - The lagging series.
 * @param maxLagMinutes - The maximum lag offset to check.
 * @returns The best correlation score and its lag.
 */
export function correlate(
  seriesA: number[],
  seriesB: number[],
  maxLagMinutes: number
): { score: number; lagMinutes: number } {
  let bestScore = -Infinity;
  let bestLag = 0;
  
  if (seriesA.length !== seriesB.length || seriesA.length === 0) {
    return { score: 0, lagMinutes: 0 };
  }
  
  const len = seriesA.length;
  const maxL = Math.min(maxLagMinutes, len - 2); 
  
  if (maxL < 0) {
    return { score: 0, lagMinutes: 0 };
  }
  
  for (let lag = 0; lag <= maxL; lag++) {
    const aSegment = seriesA.slice(0, len - lag);
    const bSegment = seriesB.slice(lag, len);
    
    const score = pearsonCorrelation(aSegment, bSegment);
    
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  
  return { score: bestScore === -Infinity ? 0 : bestScore, lagMinutes: bestLag };
}

/**
 * Compute full rolling stats for a series at a specific index.
 * Convenience function combining all the above.
 * 
 * @param values - Array of numerical values.
 * @param index - The index of the current value in the series.
 * @param baselineValue - The baseline value to compare against.
 * @param windowSize - The size of the rolling window.
 * @returns The rolling stats object for the specified point.
 */
export function computeRollingStats(
  values: number[],
  index: number,
  baselineValue: number,
  windowSize: number = DEFAULT_ROLLING_WINDOW
): RollingStats {
  const current = values[index];
  const previous = index > 0 ? values[index - 1] : current;
  
  const windowValues = values.slice(Math.max(0, index - windowSize + 1), index + 1);
  
  const means = rollingMean(windowValues, windowSize);
  const stdDevs = rollingStdDev(windowValues, windowSize);
  
  const mean = means[means.length - 1];
  const stdDev = stdDevs[stdDevs.length - 1];
  
  const z = isNaN(mean) || isNaN(stdDev) ? 0 : zScore(current, mean, stdDev);
  const pctChange = percentChange(current, previous);
  const pctChangeBaseline = percentChangeVsBaseline(current, baselineValue);
  
  const rocValues = values.slice(Math.max(0, index - DEFAULT_ROC_WINDOW + 1), index + 1);
  let roc = rateOfChange(rocValues, DEFAULT_ROC_WINDOW);
  if (isNaN(roc)) {
    roc = 0;
  }

  return {
    mean: isNaN(mean) ? 0 : mean,
    stdDev: isNaN(stdDev) ? 0 : stdDev,
    zScore: z,
    percentChange: pctChange,
    percentChangeVsBaseline: pctChangeBaseline,
    rateOfChange: roc,
  };
}
