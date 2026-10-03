class MapCoordinatesTransformer {
  /**
   * Transforma coordenadas espaciales 3D a coordenadas 2D de canvas / pantalla
   * @param {{x: number, y: number, z: number}} point3d
   * @param {{ scale?: number, originX?: number, originY?: number }} options
   * @returns {{ screenX: number, screenY: number }}
   */
  static toScreenCoordinates(point3d, options = {}) {
    if (!point3d) return null;
    const scale = options.scale || 1.0;
    const originX = options.originX || 0;
    const originY = options.originY || 0;

    return {
      screenX: Number((originX + point3d.x * scale).toFixed(2)),
      screenY: Number((originY + point3d.z * scale).toFixed(2)),
    };
  }

  /**
   * Transforma un array de coordenadas 3D a 2D
   */
  static transformPolyline(coordinates3d = [], options = {}) {
    return coordinates3d.map((c) => this.toScreenCoordinates({ x: c[0], y: c[1], z: c[2] }, options));
  }
}

module.exports = MapCoordinatesTransformer;
