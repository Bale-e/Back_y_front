const arrowCalculator = require('../../domain/services/ArrowDirectionCalculator');
const polylineSmoother = require('../../domain/services/PolylineSmoother');
const VisualizacionRutaResponseDto = require('../dtos/VisualizacionRutaResponse.dto');
const Waypoint = require('../../domain/models/Waypoint');

class GenerarVisualizacionRutaUseCase {
  constructor(calculator = arrowCalculator, smoother = polylineSmoother) {
    this.calculator = calculator;
    this.smoother = smoother;
  }

  async execute(routeCoordinates = [], metadata = {}) {
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return new VisualizacionRutaResponseDto({ waypoints: [], arrows: [], smoothedPolyline: [], metadata });
    }

    const pointsObj = routeCoordinates.map((c, idx) => ({
      x: Number(c[0]),
      y: Number(c[1]),
      z: Number(c[2]),
    }));

    // 1. Waypoints
    const waypoints = pointsObj.map((pt, idx) => {
      let type = 'intermediate';
      if (idx === 0) type = 'start';
      else if (idx === pointsObj.length - 1) type = 'end';

      return new Waypoint({
        id: `wp_${idx}`,
        point3d: pt,
        piso: metadata.piso || 'Piso 1',
        orden: idx,
        type,
      });
    });

    // 2. Flechas de dirección entre segmentos consecutivos
    const arrows = [];
    for (let i = 0; i < pointsObj.length - 1; i++) {
      const from = pointsObj[i];
      const to = pointsObj[i + 1];
      const arrow = this.calculator.calculateSegmentArrow(from, to);
      if (arrow) {
        arrows.push(arrow);
      }
    }

    // 3. Polilínea suavizada
    const smoothed = this.smoother.smooth(pointsObj);
    const smoothedPolyline = smoothed.map((p) => [p.x, p.y, p.z]);

    return new VisualizacionRutaResponseDto({
      waypoints,
      arrows,
      smoothedPolyline,
      metadata: {
        ...metadata,
        totalPoints: pointsObj.length,
        totalArrows: arrows.length,
      },
    });
  }
}

module.exports = new GenerarVisualizacionRutaUseCase();
