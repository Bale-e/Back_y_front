const fs = require('fs');
fs.writeFileSync('tsconfig.json', JSON.stringify({
  compileOnSave: false,
  compilerOptions: {
    baseUrl: './',
    downlevelIteration: true,
    importHelpers: true,
    module: 'es2020',
    moduleResolution: 'bundler',
    target: 'es2022',
    types: [],
    lib: ['es2022', 'dom']
  },
  angularCompilerOptions: { enableIvy: true },
  files: [],
  include: ['src/**/*.ts'],
  references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }]
}, null, 2));
fs.writeFileSync('tsconfig.app.json', JSON.stringify({
  extends: './tsconfig.json',
  compilerOptions: { outDir: './out-tsc/app', types: [] },
  files: ['src/main.ts', 'src/polyfills.ts'],
  include: ['src/**/*.d.ts']
}, null, 2));
fs.writeFileSync('tsconfig.spec.json', JSON.stringify({
  extends: './tsconfig.json',
  compilerOptions: { outDir: './out-tsc/spec', types: ['jasmine', 'node'] },
  files: ['src/test.ts', 'src/polyfills.ts'],
  include: ['src/**/*.spec.ts', 'src/**/*.d.ts']
}, null, 2));
fs.writeFileSync('src/polyfills.ts', "import 'zone.js';\n");
console.log('updated tsconfig and polyfills');
