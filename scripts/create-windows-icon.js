const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function createWindowsIcon() {
  try {
    const inputPath = path.join(__dirname, '..', 'assets', 'keyboard-dock.png');
    const outputPath = path.join(__dirname, '..', 'assets', 'keyboard-dock.ico');

    console.log('Converting PNG to ICO...');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error('Error: Input PNG file not found at', inputPath);
      process.exit(1);
    }

    // Convert PNG to ICO with multiple sizes for best Windows compatibility
    const icoBuffer = await pngToIco(inputPath);

    // Write the ICO file
    fs.writeFileSync(outputPath, icoBuffer);

    console.log('✓ Successfully created keyboard-dock.ico');
    console.log('  Icon includes multiple sizes for Windows compatibility');
  } catch (error) {
    console.error('Error creating Windows icon:', error);
    process.exit(1);
  }
}

createWindowsIcon();
