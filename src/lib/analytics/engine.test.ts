import { describe, it, expect } from 'vitest';
import {
  rollingMean,
  rollingStdDev,
  zScore,
  percentChange,
  percentChangeVsBaseline,
  rateOfChange,
  correlate
} from './engine';

describe('Analytics Engine', () => {
  describe('rollingMean', () => {
    it('computes rolling mean correctly', () => {
      const values = [10, 20, 30, 40, 50];
      const result = rollingMean(values, 3);
      expect(Number.isNaN(result[0])).toBe(true);
      expect(Number.isNaN(result[1])).toBe(true);
      expect(result[2]).toBe(20); // (10+20+30)/3
      expect(result[3]).toBe(30);
      expect(result[4]).toBe(40);
    });
  });

  describe('rollingStdDev', () => {
    it('computes population standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      // Let's test a window of 4
      const result = rollingStdDev(values, 4);
      
      // index 3: [2, 4, 4, 4], mean = 3.5, variance = ((2-3.5)^2 + 3*(4-3.5)^2) / 4 = (2.25 + 0.75)/4 = 3/4 = 0.75, stddev = sqrt(0.75) ≈ 0.866
      expect(result[3]).toBeCloseTo(0.866, 3);
    });
  });

  describe('zScore', () => {
    it('computes z-score correctly', () => {
      expect(zScore(10, 5, 2)).toBe(2.5);
      expect(zScore(5, 5, 2)).toBe(0);
      expect(zScore(0, 5, 2)).toBe(-2.5);
    });
    
    it('returns 0 if stdDev is 0', () => {
      expect(zScore(10, 5, 0)).toBe(0);
    });
  });

  describe('percentChange & percentChangeVsBaseline', () => {
    it('computes percent changes', () => {
      expect(percentChange(150, 100)).toBe(50);
      expect(percentChange(50, 100)).toBe(-50);
      expect(percentChange(100, 0)).toBe(0); // division by zero handled

      expect(percentChangeVsBaseline(120, 100)).toBe(20);
      expect(percentChangeVsBaseline(100, 0)).toBe(0);
    });
  });

  describe('rateOfChange', () => {
    it('computes simple linear regression slope', () => {
      // y = 2x + 10 -> slope is 2
      // x: 0, 1, 2
      // y: 10, 12, 14
      const result = rateOfChange([10, 12, 14], 3);
      expect(result).toBeCloseTo(2, 5);
      
      // y = -3x + 100 -> slope is -3
      // x: 0, 1, 2, 3
      // y: 100, 97, 94, 91
      const result2 = rateOfChange([100, 97, 94, 91], 4);
      expect(result2).toBeCloseTo(-3, 5);
    });
  });

  describe('correlate', () => {
    it('finds best correlation and lag', () => {
      const seriesA = [1, 2, 3, 4, 5, 4, 3, 2, 1, 0];
      // seriesB is seriesA shifted by 2 indices (lag of 2)
      const seriesB = [0, 0, 1, 2, 3, 4, 5, 4, 3, 2];
      
      const result = correlate(seriesA, seriesB, 4);
      
      expect(result.lagMinutes).toBe(2);
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('returns 0 for no correlation or flat series', () => {
      const seriesA = [1, 1, 1, 1, 1];
      const seriesB = [1, 1, 1, 1, 1];
      const result = correlate(seriesA, seriesB, 2);
      expect(result.score).toBe(0);
    });
  });
});
