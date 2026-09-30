import { describe, it, expect } from 'vitest';
import { TemporalAnalyzer } from '../src/attention/core/TemporalAnalyzer';
import { AttentionAnalyzer } from '../src/attention/core/AttentionAnalyzer';
import { RuleBasedClassifier } from '../src/attention/classifiers/RuleBasedClassifier';
import { resolveConfig } from '../src/attention/types/AttentionConfig';
import {
  createMockFeatures,
  createAbsentFeatures,
  createLookingFeatures,
  createEyesClosedFeatures,
} from './helpers';

/**
 * Integration test: simulates a 20-second feature stream and verifies
 * that the full pipeline (TemporalAnalyzer → RuleBasedClassifier → AttentionAnalyzer)
 * produces the correct state transitions.
 *
 * Timeline:
 *   0-5s:   focused (face present, gaze center, eyes open)
 *   5-8s:   looking right (gaze right, head turned right)
 *   8-10s:  no face (absent)
 *   10-15s: focused again
 *   15-17s: eyes closed
 *   17-20s: focused
 */
describe('Integration: 20-second simulated stream', () => {
  it('transitions through expected states', () => {
    const config = resolveConfig({
      lookingAwayThresholdMs: 1500,
      absentThresholdMs: 1500,
      prolongedEyeClosureMs: 1200,
      lookingAwayGraceMs: 500,
      absentGraceMs: 800,
    });

    const temporalAnalyzer = new TemporalAnalyzer(config);
    const classifier = new RuleBasedClassifier(config);
    const attentionAnalyzer = new AttentionAnalyzer(config, classifier);

    const msPerFrame = 50; // 20 FPS
    const states: Map<number, string> = new Map();

    function processFrame(timestamp: number, segmentType: string) {
      let features;
      switch (segmentType) {
        case 'focused':
          features = createMockFeatures({ timestamp });
          break;
        case 'looking_right':
          features = createLookingFeatures(timestamp, 'right');
          break;
        case 'absent':
          features = createAbsentFeatures(timestamp);
          break;
        case 'eyes_closed':
          features = createEyesClosedFeatures(timestamp);
          break;
        default:
          features = createMockFeatures({ timestamp });
      }

      const temporal = temporalAnalyzer.update(features);
      const result = attentionAnalyzer.analyze(features, temporal, 5);
      temporalAnalyzer.updateState(result.state, timestamp);

      return result;
    }

    // Process timeline segments
    const segments: { startMs: number; endMs: number; type: string }[] = [
      { startMs: 0, endMs: 5000, type: 'focused' },
      { startMs: 5000, endMs: 8000, type: 'looking_right' },
      { startMs: 8000, endMs: 10000, type: 'absent' },
      { startMs: 10000, endMs: 15000, type: 'focused' },
      { startMs: 15000, endMs: 17000, type: 'eyes_closed' },
      { startMs: 17000, endMs: 20000, type: 'focused' },
    ];

    for (const segment of segments) {
      for (let t = segment.startMs; t < segment.endMs; t += msPerFrame) {
        const result = processFrame(t, segment.type);
        states.set(t, result.state);
      }
    }

    // Verify expected states at key timestamps
    // At 3s: should be focused (has been focused for 3 seconds)
    expect(states.get(3000)).toBe('focused');

    // At 7s: looking right for 2s (> 1500ms threshold)
    // Should be looking_right or at least looking_away
    const stateAt7s = states.get(7000);
    expect(
      stateAt7s === 'looking_right' || stateAt7s === 'looking_away'
    ).toBe(true);

    // At 9.5s: absent for 1.5s (> 1500ms threshold)
    const stateAt9500 = states.get(9500);
    expect(stateAt9500).toBe('absent');

    // At 12s: back to focused for 2s
    expect(states.get(12000)).toBe('focused');

    // At 16.5s: eyes closed for 1.5s (> 1200ms threshold)
    expect(states.get(16500)).toBe('eyes_closed');

    // At 19s: back to focused for 2s
    expect(states.get(19000)).toBe('focused');
  });

  it('attention score correlates with state', () => {
    const config = resolveConfig();
    const temporalAnalyzer = new TemporalAnalyzer(config);
    const classifier = new RuleBasedClassifier(config);
    const attentionAnalyzer = new AttentionAnalyzer(config, classifier);

    // Focused frames should have high score
    const focusedFeatures = createMockFeatures({ timestamp: 1000 });
    const focusedTemporal = temporalAnalyzer.update(focusedFeatures);
    const focusedResult = attentionAnalyzer.analyze(focusedFeatures, focusedTemporal, 5);

    expect(focusedResult.attentionScore).toBeGreaterThan(40);

    // Absent frames should have low score
    temporalAnalyzer.reset();
    attentionAnalyzer.reset();

    const absentFeatures = createAbsentFeatures(1000);
    const absentTemporal = temporalAnalyzer.update(absentFeatures);
    const absentResult = attentionAnalyzer.analyze(absentFeatures, absentTemporal, 5);

    expect(absentResult.attentionScore).toBeLessThan(focusedResult.attentionScore);
  });
});
