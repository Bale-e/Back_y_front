/**
 * Servicio de Dominio: Suavizado de esquinas y polilíneas para renderizado visual
 */
class PolylineSmoother {
  /**
   * Suaviza una polilínea 3D insertando puntos intermedios (fillet/bezier) en giros abruptos.
   * @param {Array<{x: number, y: number, z: number}>} points
   * @param {number} cornerOffset - Distancia desde la esquina para iniciar la curva
   * @param {number} segments - Número de subdivisiones por esquina
   * @returns {Array<{x: number, y: number, z: number}>}
   */
  smooth(points, cornerOffset = 0.3, segments = 3) {
    if (!Array.isArray(points) || points.length <= 2) {
      return points || [];
    }

    const result = [{ ...points[0] }];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y, z: curr.z - prev.z };
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);

      const v2 = { x: next.x - curr.x, y: next.y - next.y, z: next.z - next.z };
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

      if (len1 < 0.001 || len2 < 0.001) {
        result.push({ ...curr });
        continue;
      }

      const offset1 = Math.min(cornerOffset, len1 * 0.4);
      const offset2 = Math.min(cornerOffset, len2 * 0.4);

      const pStart = {
        x: curr.x - (v1.x / len1) * offset1,
        y: curr.y - (v1.y / len1) * offset1,
        z: curr.z - (v1.z / len1) * offset1,
      };

      const pEnd = {
        x: curr.x + (v2.x / len2) * offset2,
        y: curr.y + (v2.y / len2) * offset2,
        z: curr.z + (v2.z / len2) * offset2,
      };

      result.push(pStart);

      for (let s = 1; s < segments; s++) {
        const t = s / segments;
        const invT = 1 - t;
        const bx = invT * invT * pStart.x + 2 * invT * t * curr.x + t * t * pEnd.x;
        const by = invT * invT * pStart.y + 2 * invT * t * curr.y + t * t * pEnd.y;
        const bz = invT * invT * pStart.z + 2 * invT * t * curr.z + t * t * pEnd.z;
        result.push({
          x: Number(bx.toFixed(3)),
          y: Number(by.toFixed(3)),
          z: Number(bz.toFixed(3)),
        });
      }

      result.push(pEnd);
    }

    result.push({ ...points[points.length - 1] });
    return result;
  }
}

module.exports = new PolylineSmoother();
