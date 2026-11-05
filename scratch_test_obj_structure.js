const fs = require('fs');

// Let's parse Instituto3D-color.obj to see how meshes are grouped
const lines = fs.readFileSync('frontend/src/assets/3d-models/sede/Instituto3D-color.obj', 'utf8').split('\n');
let currentO = '';
let currentG = '';
const list = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('o ')) {
    currentO = line.substring(2).trim();
  } else if (line.startsWith('g ')) {
    currentG = line.substring(2).trim();
  } else if (line.startsWith('usemtl ')) {
    const mat = line.substring(7).trim();
    list.push({ o: currentO, g: currentG, mat });
  }
}
console.log('Total material assignments:', list.length);
console.log('Sample assignments related to piso/suelo/patio/cancha:');
list.filter(x => x.o.toLowerCase().includes('piso') || x.g.toLowerCase().includes('piso') || x.mat.toLowerCase().includes('suelo') || x.o.toLowerCase().includes('patio')).forEach(x => {
  console.log(`  o=${x.o} | g=${x.g} | mat=${x.mat}`);
});
