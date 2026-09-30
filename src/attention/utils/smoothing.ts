/**
 * Exponential Moving Average (EMA) filter.
 */
export class ExponentialMovingAverage {
  private alpha: number;
  private value: number | null = null;

  /**
   * @param alpha Smoothing factor between 0 and 1 (higher = less smoothing)
   */
  constructor(alpha: number) {
    this.alpha = alpha;
  }

  /**
   * Updates the filter with a new value.
   * @param value New raw value
   * @returns Smoothed value
   */
  public update(value: number): number {
    if (this.value === null) {
      this.value = value;
    } else {
      this.value = this.alpha * value + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  /**
   * Gets the current smoothed value.
   * @returns Current smoothed value or 0 if uninitialized
   */
  public getValue(): number {
    return this.value ?? 0;
  }

  /**
   * Resets the filter state.
   */
  public reset(): void {
    this.value = null;
  }
}

/**
 * Simple Moving Average (SMA) filter using a sliding window.
 */
export class MovingAverage {
  private windowSize: number;
  private values: number[] = [];
  private sum: number = 0;

  /**
   * @param windowSize Number of samples to average
   */
  constructor(windowSize: number) {
    this.windowSize = windowSize;
  }

  /**
   * Updates the filter with a new value.
   * @param value New raw value
   * @returns Smoothed value
   */
  public update(value: number): number {
    this.values.push(value);
    this.sum += value;

    if (this.values.length > this.windowSize) {
      const removed = this.values.shift()!;
      this.sum -= removed;
    }

    return this.getValue();
  }

  /**
   * Gets the current smoothed value.
   * @returns Average of the window
   */
  public getValue(): number {
    if (this.values.length === 0) return 0;
    return this.sum / this.values.length;
  }

  /**
   * Gets all values currently in the window.
   * @returns Array of values
   */
  public getValues(): number[] {
    return [...this.values];
  }

  /**
   * Resets the filter state.
   */
  public reset(): void {
    this.values = [];
    this.sum = 0;
  }
}

/**
 * 1 Euro Filter for smooth and responsive tracking.
 * Based on the paper "1 € Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private derivativeCutoff: number;
  
  private xPrev: number | null = null;
  private dxPrev: number | null = null;
  private tPrev: number | null = null;

  /**
   * @param minCutoff Minimum cutoff frequency (Hz)
   * @param beta Speed coefficient
   * @param derivativeCutoff Cutoff frequency for the derivative (Hz)
   */
  constructor(minCutoff: number = 1.0, beta: number = 0.0, derivativeCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  /**
   * Filters a new value.
   * @param value New raw value
   * @param timestamp Current timestamp in milliseconds
   * @returns Filtered value
   */
  public filter(value: number, timestamp: number): number {
    if (this.tPrev === null || this.xPrev === null || this.dxPrev === null) {
      this.tPrev = timestamp;
      this.xPrev = value;
      this.dxPrev = 0;
      return value;
    }

    // Calculate time difference in seconds
    const dt = (timestamp - this.tPrev) / 1000.0;
    if (dt <= 0) {
      return this.xPrev;
    }

    // Calculate derivative
    const dx = (value - this.xPrev) / dt;
    
    // Filter derivative
    const alphaD = this.alpha(this.derivativeCutoff, dt);
    const edx = alphaD * dx + (1 - alphaD) * this.dxPrev;
    
    // Calculate cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    
    // Filter value
    const alphaX = this.alpha(cutoff, dt);
    const ex = alphaX * value + (1 - alphaX) * this.xPrev;

    // Update previous values
    this.tPrev = timestamp;
    this.xPrev = ex;
    this.dxPrev = edx;

    return ex;
  }

  /**
   * Resets the filter state.
   */
  public reset(): void {
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }
}
