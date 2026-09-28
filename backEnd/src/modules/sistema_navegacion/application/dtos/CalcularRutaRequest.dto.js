class CalcularRutaRequestDto {
  constructor({ origen, destino, piso = null, edificio = null, preferencias = {} }) {
    this.origen = origen;
    this.destino = destino;
    this.piso = piso;
    this.edificio = edificio;
    this.preferencias = preferencias;
  }
}

module.exports = CalcularRutaRequestDto;
