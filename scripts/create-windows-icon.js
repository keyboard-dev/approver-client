/* eslint-disable @typescript-eslint/no-require-imports */
const pngToIco = require('png-to-ico')
const fs = require('fs')
const path = require('path')

async function createWindowsIcon() {
  try {
    const inputPath = path.join(__dirname, '..', 'assets', 'keyboard-dock.png')
    const outputPath = path.join(__dirname, '..', 'assets', 'keyboard-dock.ico')

    if (!fs.existsSync(inputPath)) {
      process.exit(1)
    }

    // Convert PNG to ICO with multiple sizes for best Windows compatibility
    const icoBuffer = await pngToIco(inputPath)

    // Write the ICO file
    fs.writeFileSync(outputPath, icoBuffer)
  }
  catch (error) {
    process.exit(1)
  }
}

createWindowsIcon()
