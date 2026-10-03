class VisualizacionRutaResponseDto {
  constructor({ waypoints = [], arrows = [], smoothedPolyline = [], metadata = {} }) {
    this.waypoints = waypoints;
    this.arrows = arrows;
    this.smoothedPolyline = smoothedPolyline;
    this.metadata = metadata;
  }
}

module.exports = VisualizacionRutaResponseDto;
