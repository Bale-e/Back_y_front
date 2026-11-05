const fs = require('fs');
const readline = require('readline');

async function inspectPiso() {
  const fileStream = fs.createReadStream('frontend/src/assets/3d-models/sede/Instituto3D-color.obj');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let currentObj = '';
  let currentGroup = '';
  let count = 0;

  for await (const line of rl) {
    if (line.startsWith('o ')) {
      currentObj = line.substring(2).trim();
      if (currentObj.toLowerCase().includes('piso') || currentObj.toLowerCase().includes('suelo')) {
        console.log(`Object: ${currentObj}`);
      }
    } else if (line.startsWith('g ')) {
      currentGroup = line.substring(2).trim();
      if (currentGroup.toLowerCase().includes('piso') || currentGroup.toLowerCase().includes('suelo')) {
        console.log(`  Group: ${currentGroup} (under Object: ${currentObj})`);
      }
    } else if (line.startsWith('usemtl ') && (currentObj.toLowerCase().includes('piso') || currentGroup.toLowerCase().includes('piso'))) {
      console.log(`    usemtl ${line.substring(7).trim()} under ${currentObj} / ${currentGroup}`);
    }
  }
}

inspectPiso().catch(console.error);
