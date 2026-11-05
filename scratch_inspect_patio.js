const fs = require('fs');
const readline = require('readline');

async function inspectPatio() {
  const fileStream = fs.createReadStream('frontend/src/assets/3d-models/sede/Instituto3D-color.obj');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let currentObj = '';
  let currentGroup = '';

  for await (const line of rl) {
    if (line.startsWith('o ')) {
      currentObj = line.substring(2).trim();
    } else if (line.startsWith('g ')) {
      currentGroup = line.substring(2).trim();
    } else if (line.startsWith('usemtl ')) {
      if (currentObj.toLowerCase().includes('patio') || currentGroup.toLowerCase().includes('patio')) {
        console.log(`Object: ${currentObj} / Group: ${currentGroup} -> usemtl: ${line.substring(7).trim()}`);
      }
    }
  }
}

inspectPatio().catch(console.error);
