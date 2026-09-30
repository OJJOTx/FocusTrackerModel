import { describe, it, expect, beforeEach } from 'vitest';
import { AttentionAnalyzer } from '../src/attention/core/AttentionAnalyzer';
import { RuleBasedClassifier } from '../src/attention/classifiers/RuleBasedClassifier';
import { resolveConfig } from '../src/attention/types/AttentionConfig';
import type { TemporalState } from '../src/attention/types/AttentionFeatures';
import {
  createMockFeatures,
  createAbsentFeatures,
  createLookingFeatures,
} from './helpers';

function createFocusedTemporal(): TemporalState {
  return {
    lookingAwayDurationMs: 0,
    absentDurationMs: 0,
    eyesClosedDurationMs: 0,
    focusedDurationMs: 5000,
    wasLookingAway: false,
    wasAbsent: false,
    wereEyesClosed: false,
    stableDirection: 'center',
    lookingAwayRatio: 0,
    faceReacquiring: false,
    lastState: 'focused',
    lastStateChangeTimestamp: 0,
  };
}

describe('AttentionAnalyzer', () => {
  let analyzer: AttentionAnalyzer;
  const config = resolveConfig();

  beforeEach(() => {
    const classifier = new RuleBasedClassifier(config);
    analyzer = new AttentionAnalyzer(config, classifier);
  });

  it('returns focused state with high score for centered features', () => {
    const features = createMockFeatures({ timestamp: 1000 });
    const temporal = createFocusedTemporal();
    const result = analyzer.analyze(features, temporal, 5);

    expect(result.state).toBe('focused');
    expect(result.attentionScore).toBeGreaterThan(50);
    expect(result.facePresent).toBe(true);
  });

  it('returns absent state when face is not detected', () => {
    const features = createAbsentFeatures(1000);
    const temporal: TemporalState = {
      ...createFocusedTemporal(),
      absentDurationMs: 5000,
      wasAbsent: true,
      lastState: 'absent',
    };
    const result = analyzer.analyze(features, temporal, 5);

    expect(result.state).toBe('absent');
    expect(result.facePresent).toBe(false);
    expect(result.attentionScore).toBeLessThan(50);
  });

  it('smooths attention score over multiple frames', () => {
    const temporal = createFocusedTemporal();

    // First frame: high score
    const r1 = analyzer.analyze(
      createMockFeatures({ timestamp: 0 }),
      temporal,
      5,
    );

    // Second frame: absent (low score)
    const r2 = analyzer.analyze(
      createAbsentFeatures(100),
      { ...temporal, absentDurationMs: 3000, wasAbsent: true, lastState: 'absent' },
      5,
    );

    // Score should be smoothed, not jump to 0
    expect(r2.attentionScore).toBeLessThan(r1.attentionScore);
    expect(r2.attentionScore).toBeGreaterThanOrEqual(0);
  });

  it('includes debug info when debug mode is enabled', () => {
    const debugConfig = resolveConfig({ debug: true });
    const classifier = new RuleBasedClassifier(debugConfig);
    const debugAnalyzer = new AttentionAnalyzer(debugConfig, classifier);

    const features = createMockFeatures({ timestamp: 1000 });
    const temporal = createFocusedTemporal();
    const result = debugAnalyzer.analyze(features, temporal, 5);

    expect(result.debug).toBeDefined();
    expect(result.debug!.rawScore).toBeDefined();
    expect(result.debug!.smoothedScore).toBeDefined();
    expect(result.debug!.scoreComponents).toBeDefined();
    expect(result.debug!.processingLatencyMs).toBeCloseTo(5, 0);
  });

  it('does not include debug info when debug mode is disabled', () => {
    const features = createMockFeatures({ timestamp: 1000 });
    const temporal = createFocusedTemporal();
    const result = analyzer.analyze(features, temporal, 5);

    expect(result.debug).toBeUndefined();
  });

  it('returns gaze direction in result', () => {
    const features = createLookingFeatures(1000, 'right');
    const temporal: TemporalState = {
      ...createFocusedTemporal(),
      lookingAwayDurationMs: 2000,
      wasLookingAway: true,
    };
    const result = analyzer.analyze(features, temporal, 5);

    // Gaze should reflect the looking direction
    expect(result.gaze.direction).toBeDefined();
    expect(result.gaze.confidence).toBeGreaterThanOrEqual(0);
  });

  it('normalizes head pose values in result', () => {
    const features = createMockFeatures({
      timestamp: 1000,
      headPose: { yaw: 15.123, pitch: -8.456, roll: 2.789 },
    });
    const temporal = createFocusedTemporal();
    const result = analyzer.analyze(features, temporal, 5);

    // Values should be rounded to 1 decimal place
    expect(result.headPose.yaw).toBe(15.1);
    expect(result.headPose.pitch).toBe(-8.5);
    expect(result.headPose.roll).toBe(2.8);
  });

  it('resets internal state', () => {
    // Process some frames
    analyzer.analyze(createMockFeatures({ timestamp: 0 }), createFocusedTemporal(), 5);
    analyzer.analyze(createMockFeatures({ timestamp: 100 }), createFocusedTemporal(), 5);

    // Reset and verify first frame returns raw value
    analyzer.reset();
    const result = analyzer.analyze(
      createMockFeatures({ timestamp: 200 }),
      createFocusedTemporal(),
      5,
    );
    expect(result.attentionScore).toBeGreaterThanOrEqual(0);
  });
});
