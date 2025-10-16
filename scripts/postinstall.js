#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

console.log('Running postinstall setup...');

// Check and install dual binary if needed
const dualPackagePath = join(__dirname, '..', 'node_modules', '@lightfastai', 'dual');
const dualBinaryPath = join(dualPackagePath, 'bin', 'dual');

if (existsSync(dualPackagePath)) {
  if (!existsSync(dualBinaryPath)) {
    console.log('Installing dual binary...');
    try {
      execSync('npm run postinstall', {
        cwd: dualPackagePath,
        stdio: 'inherit'
      });
      console.log('✓ dual binary installed successfully');
    } catch (error) {
      console.warn('Warning: Failed to install dual binary automatically');
      console.warn('You may need to manually run: cd node_modules/@lightfastai/dual && npm run postinstall');
    }
  } else {
    console.log('✓ dual binary already installed');
  }
}

console.log('Postinstall setup complete!');