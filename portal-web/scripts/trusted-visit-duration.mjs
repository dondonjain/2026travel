export function validatedNarrativeDwellMs(feature, allowedValues, fallbackMs) {
  const value = feature?.properties?.narrativeDwellMs;
  return allowedValues.includes(value) ? value : fallbackMs;
}
