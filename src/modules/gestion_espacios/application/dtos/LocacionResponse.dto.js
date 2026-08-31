class LocacionResponseDto {
  constructor({ id, nombre, tipo, piso, cuerpo = null, coordenadas = null, edificioId = null, edificioNombre = null }) {
    this.id = id;
    this.nombre = nombre;
    this.tipo = tipo;
    this.piso = piso;
    this.cuerpo = cuerpo;
    this.coordenadas = coordenadas;
    this.edificioId = edificioId;
    this.edificioNombre = edificioNombre;
  }
}

module.exports = LocacionResponseDto;
