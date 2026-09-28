class RutaCalculadaResponseDto {
  constructor({ startName, endName, startPathId = null, endPathId = null, coordinates = [], distance = 0, steps = [] }) {
    this.startName = startName;
    this.endName = endName;
    this.startPathId = startPathId;
    this.endPathId = endPathId;
    this.coordinates = coordinates;
    this.distance = distance;
    this.steps = steps;
  }
}

module.exports = RutaCalculadaResponseDto;
