/**
 * Given a race date, start time, finish time, and per-waypoint fractions
 * (e.g. [0, 0.25, 0.5, 0.75, 1.0]), returns an ISO datetime string for each
 * waypoint, rounded to the nearest hour (as Open-Meteo hourly data is per full hour).
 *
 * @param date     "YYYY-MM-DD"
 * @param start    "HH:MM"  e.g. "09:00"
 * @param finish   "HH:MM"  e.g. "12:00"
 * @param fractions  numbers in [0, 1] — one per waypoint
 * @returns  array of "YYYY-MM-DDTHH:00" strings (same length as fractions)
 */
export function calcWaypointTimes(
  date: string,
  start: string,
  finish: string,
  fractions: number[]
): string[] {
  const [startH, startM] = start.split(":").map(Number);
  const [finishH, finishM] = finish.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const finishMinutes = finishH * 60 + finishM;
  const totalMinutes = finishMinutes - startMinutes;

  return fractions.map((fraction) => {
    const offsetMinutes = Math.round(fraction * totalMinutes);
    const absoluteMinutes = startMinutes + offsetMinutes;

    // Round to nearest hour
    const hour = Math.round(absoluteMinutes / 60);
    // Clamp to valid hour range (handles edge cases like 23:45 rounding to 24)
    const clampedHour = Math.min(23, Math.max(0, hour));

    const paddedHour = String(clampedHour).padStart(2, "0");
    return `${date}T${paddedHour}:00`;
  });
}

/**
 * Extracts just the display time ("HH:00") from a waypoint datetime string.
 * e.g. "2025-08-23T10:00" → "10:00"
 */
export function formatArrivalTime(datetime: string): string {
  return datetime.split("T")[1] ?? "";
}

/**
 * Returns the fractions [0, 0.25, 0.5, 0.75, 1.0] for the standard 5-waypoint
 * layout used in all ritt.
 */
export const WAYPOINT_FRACTIONS = [0, 0.25, 0.5, 0.75, 1.0] as const;
