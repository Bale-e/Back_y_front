/**
 * Value Object inmutable para representar vectores directores 2D.
 */
class Vector2D {
  constructor(x, y) {
    this.x = Number(x);
    this.y = Number(y);
    Object.freeze(this);
  }

  static fromPoints(p1, p2) {
    return new Vector2D(p2.x - p1.x, p2.y - p1.y);
  }

  get magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const mag = this.magnitude;
    if (mag === 0) return new Vector2D(0, 0);
    return new Vector2D(this.x / mag, this.y / mag);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
  }

  toJSON() {
    return { x: this.x, y: this.y };
  }
}

module.exports = Vector2D;
