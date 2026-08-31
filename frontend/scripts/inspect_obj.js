const fs = require('fs');
const path = require('path');

function parseObjFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const meshes = [];
  let currentMesh = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('o ') || line.startsWith('g ')) {
      const name = line.substring(2).trim();
      currentMesh = { name, vertices: [] };
      meshes.push(currentMesh);
    } else if (line.startsWith('v ') && currentMesh) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3) {
        currentMesh.vertices.push(parts);
      }
    }
  }

  console.log(`=== File: ${path.basename(filepath)} ===`);
  console.log(`Total meshes: ${meshes.length}`);
  meshes.forEach(m => {
    if (m.vertices.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      m.vertices.forEach(([x, y, z]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      });
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      console.log(`  Mesh: ${m.name.padEnd(20)} | Vertices: ${m.vertices.length.toString().padEnd(5)} | Center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`);
    } else {
      console.log(`  Mesh: ${m.name.padEnd(20)} | Vertices: 0`);
    }
  });
}

const dir = path.join(__dirname, '../src/assets/3d-models/Edificio A');
parseObjFile(path.join(dir, 'Edifico A - Piso 1.obj'));
parseObjFile(path.join(dir, 'Edificio A - piso 2.obj'));
