import { describe, it, expect, beforeEach } from 'vitest';
import { TemporalAnalyzer } from '../src/attention/core/TemporalAnalyzer';
import { resolveConfig } from '../src/attention/types/AttentionConfig';
import {
  createMockFeatures,
  createAbsentFeatures,
  createLookingFeatures,
  createEyesClosedFeatures,
} from './helpers';

describe('TemporalAnalyzer', () => {
  let analyzer: TemporalAnalyzer;

  beforeEach(() => {
    analyzer = new TemporalAnalyzer(resolveConfig());
  });

  it('keeps absentDurationMs at 0 when face is present', () => {
    analyzer.update(createMockFeatures({ timestamp: 0 }));
    const state = analyzer.update(createMockFeatures({ timestamp: 1000 }));
    expect(state.absentDurationMs).toBe(0);
  });

  it('accumulates absentDurationMs when face is absent', () => {
    // First frame: face present
    analyzer.update(createMockFeatures({ timestamp: 0 }));

    // Face disappears
    analyzer.update(createAbsentFeatures(1000));
    const state = analyzer.update(createAbsentFeatures(4000));

    // Duration should be 4000 - 1000 = 3000ms
    expect(state.absentDurationMs).toBeGreaterThanOrEqual(3000);
  });

  it('accumulates lookingAwayDurationMs when looking away', () => {
    analyzer.update(createMockFeatures({ timestamp: 0 }));
    analyzer.update(createLookingFeatures(1000, 'left'));
    const state = analyzer.update(createLookingFeatures(3000, 'left'));

    expect(state.lookingAwayDurationMs).toBeGreaterThanOrEqual(2000);
  });

  it('accumulates eyesClosedDurationMs when eyes are closed', () => {
    analyzer.update(createMockFeatures({ timestamp: 0 }));
    analyzer.update(createEyesClosedFeatures(1000));
    const state = analyzer.update(createEyesClosedFeatures(2500));

    expect(state.eyesClosedDurationMs).toBeGreaterThanOrEqual(1500);
  });

  it('tracks focusedDurationMs when focused', () => {
    analyzer.update(createMockFeatures({ timestamp: 0 }));
    const state = analyzer.update(createMockFeatures({ timestamp: 5000 }));

    expect(state.focusedDurationMs).toBeGreaterThan(0);
  });

  it('resets all durations', () => {
    analyzer.update(createAbsentFeatures(0));
    analyzer.update(createAbsentFeatures(2000));
    analyzer.reset();

    const state = analyzer.update(createMockFeatures({ timestamp: 2050 }));
    expect(state.absentDurationMs).toBe(0);
    expect(state.eyesClosedDurationMs).toBe(0);
    expect(state.lookingAwayDurationMs).toBe(0);
  });

  it('resets absent duration when face returns', () => {
    analyzer.update(createAbsentFeatures(0));
    analyzer.update(createAbsentFeatures(2000));
    // Face returns
    const state = analyzer.update(createMockFeatures({ timestamp: 3000 }));
    expect(state.absentDurationMs).toBe(0);
  });

  it('resets eyes closed duration when eyes open', () => {
    analyzer.update(createEyesClosedFeatures(0));
    analyzer.update(createEyesClosedFeatures(1500));
    // Eyes open
    const state = analyzer.update(createMockFeatures({ timestamp: 2000 }));
    expect(state.eyesClosedDurationMs).toBe(0);
  });
});
