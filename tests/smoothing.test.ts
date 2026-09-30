import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExponentialMovingAverage,
  MovingAverage,
  OneEuroFilter,
} from '../src/attention/utils/smoothing';

describe('ExponentialMovingAverage', () => {
  let ema: ExponentialMovingAverage;

  beforeEach(() => {
    ema = new ExponentialMovingAverage(0.5);
  });

  it('returns first value as-is', () => {
    expect(ema.update(10)).toBe(10);
  });

  it('smooths subsequent values', () => {
    ema.update(10);
    // EMA = 0.5 * 20 + 0.5 * 10 = 15
    expect(ema.update(20)).toBe(15);
  });

  it('returns raw value when alpha is 1', () => {
    const raw = new ExponentialMovingAverage(1);
    raw.update(10);
    expect(raw.update(20)).toBe(20);
  });

  it('returns initial value when alpha is 0', () => {
    const fixed = new ExponentialMovingAverage(0);
    fixed.update(10);
    expect(fixed.update(20)).toBe(10);
  });

  it('getValue returns 0 before any update', () => {
    expect(ema.getValue()).toBe(0);
  });

  it('getValue returns current smoothed value', () => {
    ema.update(10);
    ema.update(20);
    expect(ema.getValue()).toBe(15);
  });

  it('resets to initial state', () => {
    ema.update(10);
    ema.update(20);
    ema.reset();
    expect(ema.getValue()).toBe(0);
    expect(ema.update(100)).toBe(100);
  });
});

describe('MovingAverage', () => {
  let ma: MovingAverage;

  beforeEach(() => {
    ma = new MovingAverage(3);
  });

  it('calculates average within window', () => {
    expect(ma.update(10)).toBe(10);
    expect(ma.update(20)).toBe(15);
    expect(ma.update(30)).toBe(20);
  });

  it('slides window when full', () => {
    ma.update(10);
    ma.update(20);
    ma.update(30);
    // Window: [20, 30, 40], avg = 30
    expect(ma.update(40)).toBe(30);
  });

  it('provides getValue and getValues', () => {
    ma.update(10);
    ma.update(20);
    expect(ma.getValue()).toBe(15);
    expect(ma.getValues()).toEqual([10, 20]);
  });

  it('resets to empty state', () => {
    ma.update(10);
    ma.update(20);
    ma.reset();
    expect(ma.getValue()).toBe(0);
    expect(ma.getValues()).toEqual([]);
    expect(ma.update(100)).toBe(100);
  });
});

describe('OneEuroFilter', () => {
  let filter: OneEuroFilter;

  beforeEach(() => {
    filter = new OneEuroFilter(1.0, 0.007, 1.0);
  });

  it('returns first value as-is', () => {
    expect(filter.filter(10, 0)).toBeCloseTo(10);
  });

  it('smooths subsequent values', () => {
    filter.filter(10, 0);
    const v = filter.filter(20, 100);
    // Should be between 10 and 20 due to smoothing
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThanOrEqual(20);
  });

  it('converges to constant input', () => {
    filter.filter(10, 0);
    filter.filter(10, 100);
    const v = filter.filter(10, 200);
    expect(v).toBeCloseTo(10, 1);
  });

  it('resets to initial state', () => {
    filter.filter(10, 0);
    filter.filter(20, 100);
    filter.reset();
    expect(filter.filter(50, 200)).toBeCloseTo(50);
  });
});
