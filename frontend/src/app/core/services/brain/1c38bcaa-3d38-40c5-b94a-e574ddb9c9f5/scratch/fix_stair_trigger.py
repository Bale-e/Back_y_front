import re

filepath = 'frontend/src/app/map3d/components/map3d-container.component.ts'
content = open(filepath, encoding='utf-8').read()

start = content.find('  public isFloorSelectionTrigger')
end = content.find('\n  }', start) + 4

old = content[start:end]
print('OLD len:', len(old))
print('OLD snippet:', repr(old[:100]))

new_fn = (
    "  public isFloorSelectionTrigger(meshName: string | null | undefined): boolean {\n"
    "    if (!meshName) return false;\n"
    "    const raw = meshName.toLowerCase();\n"
    "    const normalized = raw.replace(/[^a-z0-9]/g, '');\n"
    "\n"
    "    // 1. Nombre semantico de escalera (siempre es escalera sin importar edificio)\n"
    "    if (/escalera|stair|stairs/.test(raw)) return true;\n"
    "\n"
    "    // 2. Grupos de escaleras en modelos nuevos (C/D/E): 'cp1grupo1', 'dp2grupo3'\n"
    "    //    Patron: [letra]p[digito]grupo -- excluye salas tipo 'c101', 'd203', 'e104'\n"
    "    if (/^[a-z]p\\d+grupo/.test(normalized)) return true;\n"
    "\n"
    "    // 3. Mallas de escaleras en modelos ANTIGUOS (solo Edificios A y B).\n"
    "    //    Estos cuerposN NO son escaleras en C/D/E (son salas normales).\n"
    "    if (this.currentBuilding === 'A' || this.currentBuilding === 'B') {\n"
    "      // Son escalera en A y en B\n"
    "      const stairBodiesAB = [\n"
    "        'cuerpo21', 'cuerpo23', 'cuerpo26', 'cuerpo25', 'cuerpo30',\n"
    "        'cuerpo45', 'cuerpo39', 'cuerpo0', 'cuerpo97'\n"
    "      ];\n"
    "      if (stairBodiesAB.includes(normalized)) return true;\n"
    "\n"
    "      // Solo son escalera en Edificio A\n"
    "      if (this.currentBuilding === 'A') {\n"
    "        const stairBodiesOnlyA = ['cuerpo6', 'cuerpo8', 'cuerpo9', 'cuerpo13', 'cuerpo14', 'cuerpo15', 'cuerpo18'];\n"
    "        if (stairBodiesOnlyA.includes(normalized)) return true;\n"
    "      }\n"
    "    }\n"
    "\n"
    "    return false;\n"
    "  }"
)

new_content = content[:start] + new_fn + content[end:]
open(filepath, 'w', encoding='utf-8').write(new_content)
print('Done. NEW len:', len(new_fn))
