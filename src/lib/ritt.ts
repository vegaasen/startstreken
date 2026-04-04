import type { Waypoint } from "./weather";

/**
 * Computes accumulated elevation gain (metres climbed) from an ordered list
 * of waypoints with altitude data. Only positive altitude differences are summed.
 */
export function computeElevationGain(waypoints: Waypoint[]): number | null {
  const withAlt = waypoints.filter((w) => w.altitude != null);
  if (withAlt.length < 2) return null;

  let gain = 0;
  for (let i = 1; i < withAlt.length; i++) {
    const diff = withAlt[i].altitude! - withAlt[i - 1].altitude!;
    if (diff > 0) gain += diff;
  }
  return gain;
}
