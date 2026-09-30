/**
 * Represents a 2D point or vector.
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Represents a 3D point or vector.
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculates the Euclidean distance between two 2D points.
 * @param a First point
 * @param b Second point
 * @returns The distance between a and b
 */
export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Calculates the Euclidean distance between two 3D points.
 * @param a First point
 * @param b Second point
 * @returns The distance between a and b
 */
export function distance3D(a: Point3D, b: Point3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/**
 * Converts degrees to radians.
 * @param deg Angle in degrees
 * @returns Angle in radians
 */
export function degreesToRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 * @param rad Angle in radians
 * @returns Angle in degrees
 */
export function radiansToDegrees(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Clamps a value between a minimum and maximum.
 * @param value The value to clamp
 * @param min Minimum bound
 * @param max Maximum bound
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolates between two values.
 * @param a Start value
 * @param b End value
 * @param t Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Normalizes a value from a given range to 0-1.
 * @param value The value to normalize
 * @param min Minimum of the original range
 * @param max Maximum of the original range
 * @returns Normalized value (0-1)
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Calculates the dot product of two 3D vectors.
 * @param a First vector
 * @param b Second vector
 * @returns Dot product
 */
export function dotProduct(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Calculates the cross product of two 3D vectors.
 * @param a First vector
 * @param b Second vector
 * @returns Cross product vector
 */
export function crossProduct(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/**
 * Calculates the magnitude (length) of a 3D vector.
 * @param v The vector
 * @returns Length of the vector
 */
export function vectorLength(v: Point3D): number {
  return Math.hypot(v.x, v.y, v.z);
}

/**
 * Normalizes a 3D vector to a unit vector (length of 1).
 * @param v The vector to normalize
 * @returns Unit vector
 */
export function normalizeVector(v: Point3D): Point3D {
  const len = vectorLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len
  };
}
