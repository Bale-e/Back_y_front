const fs = require('fs');
const readline = require('readline');

async function inspectPisoBounds() {
  const fileStream = fs.createReadStream('frontend/src/assets/3d-models/sede/Instituto3D-color.obj');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const vertices = [null]; // 1-based index
  let currentObj = '';
  let inPiso = false;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;

  for await (const line of rl) {
    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      vertices.push({ x: parts[0], y: parts[1], z: parts[2] });
    } else if (line.startsWith('o ')) {
      currentObj = line.substring(2).trim();
      inPiso = currentObj.toLowerCase() === 'piso';
    } else if (inPiso && line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1);
      for (const p of parts) {
        const vIdx = parseInt(p.split('/')[0], 10);
        const v = vertices[vIdx];
        if (v) {
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.z > maxZ) maxZ = v.z;
        }
      }
    }
  }

  console.log('Bounds of o Piso:');
  console.log(`  X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
  console.log(`  Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
  console.log(`  Z: [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
}

inspectPisoBounds().catch(console.error);
