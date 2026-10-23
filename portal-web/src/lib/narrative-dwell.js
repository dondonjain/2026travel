export const NARRATIVE_DWELL_FALLBACK_MS = 4_000;
export const NARRATIVE_DWELL_ALLOWED_MS = [1_500, 2_000, 2_800, 4_000, 5_000, 6_500, 8_000];

/**
 * Maps a trusted, Visit-local duration to the provisional narrative dwell
 * contract. The result is storytelling pacing, not a representation of real
 * elapsed time. Callers must never derive this input from GPS or neighbouring
 * Visit timestamps.
 */
export function narrativeDwellMsFromTrustedDurationMinutes(durationMinutes) {
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes) || durationMinutes < 0) {
    return NARRATIVE_DWELL_FALLBACK_MS;
  }
  if (durationMinutes < 30) return 1_500;
  if (durationMinutes < 45) return 2_000;
  if (durationMinutes < 60) return 2_800;
  if (durationMinutes < 90) return 4_000;
  if (durationMinutes < 120) return 5_000;
  if (durationMinutes < 180) return 6_500;
  return 8_000;
}

/** Accepts only the public, derived values permitted by the Visit contract. */
export function narrativeDwellMsFromPublicValue(value) {
  return typeof value === 'number' && NARRATIVE_DWELL_ALLOWED_MS.includes(value)
    ? value
    : NARRATIVE_DWELL_FALLBACK_MS;
}
