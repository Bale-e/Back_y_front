const fs = require('fs');
const readline = require('readline');

async function inspectSedeObj() {
  const fileStream = fs.createReadStream('frontend/src/assets/3d-models/sede/Instituto3D-color.obj');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let currentObj = '';
  let currentGroup = '';
  const objMats = {};

  for await (const line of rl) {
    if (line.startsWith('o ')) {
      currentObj = line.substring(2).trim();
    } else if (line.startsWith('g ')) {
      currentGroup = line.substring(2).trim();
    } else if (line.startsWith('usemtl ')) {
      const mat = line.substring(7).trim();
      const key = `${currentObj} -> ${currentGroup}`;
      if (!objMats[mat]) objMats[mat] = [];
      if (objMats[mat].length < 5) objMats[mat].push(key);
    }
  }

  console.log('=== Materials and objects in Instituto3D-color.obj ===');
  for (const [mat, objs] of Object.entries(objMats)) {
    console.log(`${mat}: (${objs.length} uses) e.g. ${objs.join('; ')}`);
  }
}

inspectSedeObj().catch(console.error);
