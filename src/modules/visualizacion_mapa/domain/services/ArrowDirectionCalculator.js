const ArrowOrientation = require('../models/ArrowOrientation');
const Angle = require('../../../../shared/domain/value-objects/Angle');

/**
 * Servicio de Dominio: Cálculo de Orientación, Vectores y Dirección de Flechas
 */
class ArrowDirectionCalculator {
  /**
   * Calcula la orientación y ángulo de la flecha entre dos puntos consecutivos.
   * @param {{x: number, y: number, z: number}} fromPoint
   * @param {{x: number, y: number, z: number}} toPoint
   * @returns {ArrowOrientation}
   */
  calculateSegmentArrow(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) return null;

    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const dz = toPoint.z - fromPoint.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length < 0.0001) {
      return new ArrowOrientation({
        angleDegrees: 0,
        vectorDirection: { x: 0, y: 0, z: 0 },
        position: { ...fromPoint },
        length: 0,
      });
    }

    const vectorDirection = {
      x: dx / length,
      y: dy / length,
      z: dz / length,
    };

    const angleRad = Math.atan2(dx, dz);
    const angleDegrees = Angle.radToDeg(angleRad);

    const arrowPos = {
      x: fromPoint.x + dx * 0.75,
      y: fromPoint.y + dy * 0.75,
      z: fromPoint.z + dz * 0.75,
    };

    return new ArrowOrientation({
      angleDegrees: Number(angleDegrees.toFixed(2)),
      vectorDirection,
      position: arrowPos,
      length: Number(length.toFixed(2)),
    });
  }
}

module.exports = new ArrowDirectionCalculator();
