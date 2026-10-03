class PathSegment {
  constructor({ from, to, angleDegrees = 0, vectorDirection = null, length = 0, piso = null }) {
    this.from = from;
    this.to = to;
    this.angleDegrees = angleDegrees;
    this.vectorDirection = vectorDirection;
    this.length = length;
    this.piso = piso;
  }
}

module.exports = PathSegment;
