#!/usr/bin/env node

/**
 * Test script to verify 3proxy binary detection
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function getBundledBinaryPaths() {
  const platform = os.platform();
  const paths = [];

  // In development mode
  const devPath = platform === 'win32' 
    ? path.join(projectRoot, 'resources', 'bin', '3proxy-win32.exe')
    : path.join(projectRoot, 'resources', 'bin', `3proxy-${platform}`);
  paths.push(devPath);

  // In production (packaged app)
  if (process.resourcesPath) {
    const prodPath = platform === 'win32'
      ? path.join(process.resourcesPath, 'bin', '3proxy-win32.exe')
      : path.join(process.resourcesPath, 'bin', `3proxy-${platform}`);
    paths.push(prodPath);
  }

  return paths;
}

console.log('=== 3proxy Binary Detection Test ===\n');
console.log('Platform:', os.platform());
console.log('Architecture:', os.arch());
console.log('Project Root:', projectRoot);
console.log('\nSearching for bundled binaries...\n');

const paths = getBundledBinaryPaths();
let found = false;

for (const p of paths) {
  const exists = fs.existsSync(p);
  console.log(`${exists ? '✓' : '✗'} ${p}`);
  
  if (exists) {
    found = true;
    const stats = fs.statSync(p);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`  Executable: ${(stats.mode & 0o111) !== 0 ? 'Yes' : 'No'}`);
  }
}

if (found) {
  console.log('\n✓ Binary found and ready to use!');
} else {
  console.log('\n✗ Binary not found. Run: npm run download-binaries');
}