#!/usr/bin/env node

/**
 * Release build script with proper error handling and logging
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function log(message) {
  console.log(`[BUILD] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

function runCommand(command, options = {}) {
  log(`Running: ${command}`);
  try {
    const result = execSync(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      ...options
    });
    return result;
  } catch (err) {
    error(`Command failed: ${command}`);
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const platform = args[0] || 'all';
  const isDev = args.includes('--dev');
  
  log('Starting release build process...');
  log(`Platform: ${platform}`);
  log(`Development mode: ${isDev}`);
  
  try {
    // Clean previous builds
    log('Cleaning previous builds...');
    if (fs.existsSync(path.join(projectRoot, 'dist'))) {
      fs.rmSync(path.join(projectRoot, 'dist'), { recursive: true });
    }
    if (fs.existsSync(path.join(projectRoot, 'dist-electron'))) {
      fs.rmSync(path.join(projectRoot, 'dist-electron'), { recursive: true });
    }
    
    // Download binaries
    log('Downloading required binaries...');
    runCommand('npm run download-binaries');
    
    // Type check
    log('Running type check...');
    runCommand('npm run compile');
    
    // Build renderer
    log('Building renderer process...');
    runCommand('npm run build:renderer');
    
    // Build based on platform
    if (platform === 'all' || platform === 'current') {
      log('Building for current platform...');
      runCommand(isDev ? 'npm run build:dev' : 'npm run build:electron');
    } else {
      switch (platform) {
        case 'mac':
          log('Building for macOS...');
          runCommand('npm run dist:mac');
          break;
        case 'win':
          log('Building for Windows...');
          runCommand('npm run dist:win');
          break;
        case 'linux':
          log('Building for Linux...');
          runCommand('npm run dist:linux');
          break;
        default:
          error(`Unknown platform: ${platform}`);
          process.exit(1);
      }
    }
    
    log('✅ Build completed successfully!');
    
    // Show output directory
    const releaseDir = path.join(projectRoot, 'release');
    if (fs.existsSync(releaseDir)) {
      log(`📦 Release files available in: ${releaseDir}`);
      const files = fs.readdirSync(releaseDir, { recursive: true });
      files.forEach(file => {
        if (typeof file === 'string' && !file.includes('/')) {
          log(`  - ${file}`);
        }
      });
    }
    
  } catch (err) {
    error('Build failed!');
    error(err.message);
    process.exit(1);
  }
}

main();