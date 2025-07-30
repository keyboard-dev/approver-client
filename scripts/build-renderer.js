/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Simple TypeScript to JavaScript transpiler for the renderer
// Since the renderer runs in the browser context, we need to compile it separately

const typescript = `
const tsc = require('typescript');
const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, '../public/renderer.ts');
const outputPath = path.join(__dirname, '../public/renderer.js');

// Read the TypeScript file
const source = fs.readFileSync(rendererPath, 'utf8');

// Compile options
const options = {
  target: tsc.ScriptTarget.ES2020,
  module: tsc.ModuleKind.ES2020,
  removeComments: true,
  strict: false,
  skipLibCheck: true
};

// Transpile
const result = tsc.transpileModule(source, { compilerOptions: options });

// Write the output
fs.writeFileSync(outputPath, result.outputText);
`

// Write a temporary TypeScript compiler
fs.writeFileSync(path.join(__dirname, 'temp-compile.js'), typescript)

try {
  // Run the compiler
  execSync('node ' + path.join(__dirname, 'temp-compile.js'), { stdio: 'inherit' })

  // Clean up
  fs.unlinkSync(path.join(__dirname, 'temp-compile.js'))
}
catch (error) {
  console.error('Error compiling renderer:', error)
  process.exit(1)
}
