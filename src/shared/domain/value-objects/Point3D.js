/**
 * Value Object inmutable para representar coordenadas espaciales 3D.
 */
class Point3D {
  constructor(x, y, z) {
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
    Object.freeze(this);
  }

  static create(x, y, z) {
    if (x == null || y == null || z == null || isNaN(x) || isNaN(y) || isNaN(z)) {
      return null;
    }
    return new Point3D(x, y, z);
  }

  distanceTo(other) {
    if (!other) return Infinity;
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  toJSON() {
    return { x: this.x, y: this.y, z: this.z };
  }
}

module.exports = Point3D;
