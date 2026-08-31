class EdificioResponseDto {
  constructor({ id, nombre, descripcion = '', pisos = [], coordenadas = null }) {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.pisos = pisos;
    this.coordenadas = coordenadas;
  }
}

module.exports = EdificioResponseDto;
