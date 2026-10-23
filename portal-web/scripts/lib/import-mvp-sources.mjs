export function prepareMvpImportData(parsedTrajectory, enrichedTrajectory) {
  const technicalLineFeature = enrichedTrajectory.features.find(
    (feature) => feature.geometry.type === 'LineString'
  );
  const curatedVisitPointFeatures = parsedTrajectory.features.filter(
    (feature) => feature.geometry.type === 'Point'
  );
  const technicalCoordinates = technicalLineFeature?.geometry.coordinates;
  const technicalTimes = enrichedTrajectory.properties?.times;

  if (!Array.isArray(technicalCoordinates) || !Array.isArray(technicalTimes)) {
    throw new Error('Golden enriched trajectory is missing coordinates or timestamps');
  }
  if (technicalCoordinates.length !== technicalTimes.length) {
    throw new Error('Golden enriched trajectory coordinate/timestamp counts do not match');
  }

  return {
    curatedVisitPointFeatures,
    technicalSamples: technicalCoordinates.map((coordinate, sequenceNo) => ({
      coordinate,
      sequenceNo,
      timestamp: technicalTimes[sequenceNo]
    }))
  };
}
