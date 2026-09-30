/**
 * Attention Classifier Interface
 *
 * Defines the contract for attention classification strategies.
 * V1 uses a rule-based approach; this interface allows future
 * ML-based classifiers to be swapped in.
 */

import { AttentionFeatures, AttentionPrediction, TemporalState } from '../types/AttentionFeatures';

/**
 * Interface for attention classifiers.
 * Classifiers take extracted features and temporal state and produce a prediction.
 */
export interface AttentionClassifier {
  /**
   * Classify the current attention state from features and temporal context.
   *
   * @param features - Current frame features (face, gaze, head pose, eye state)
   * @param temporal - Accumulated temporal state (durations, previous states)
   * @returns Prediction with state, confidence, and score components
   */
  classify(features: AttentionFeatures, temporal: TemporalState): AttentionPrediction;
}
