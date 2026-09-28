/**
 * Value Object: Orientación y Geometría de la Flecha de Dibujado
 */
class ArrowOrientation {
  constructor({ angleDegrees, vectorDirection, position, length = 1 }) {
    this.angleDegrees = angleDegrees;
    this.vectorDirection = vectorDirection;
    this.position = position;
    this.length = length;
  }
}

module.exports = ArrowOrientation;
