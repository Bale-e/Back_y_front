/**
 * Value Object para conversiones y normalización de ángulos.
 */
class Angle {
  constructor(radians) {
    this.radians = Number(radians);
    Object.freeze(this);
  }

  static fromDegrees(degrees) {
    return new Angle((degrees * Math.PI) / 180);
  }

  static fromRadians(radians) {
    return new Angle(radians);
  }

  static radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  static degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  get degrees() {
    return Angle.radToDeg(this.radians);
  }

  normalize() {
    let rad = this.radians % (2 * Math.PI);
    if (rad < 0) rad += 2 * Math.PI;
    return new Angle(rad);
  }
}

module.exports = Angle;
