#!/usr/bin/env node

/**
 * Script to download 3proxy binaries for different platforms
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const binDir = path.join(projectRoot, 'resources', 'bin');

// Ensure bin directory exists
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const PROXY_VERSION = '0.9.4';
const DOWNLOAD_URL = `https://github.com/3proxy/3proxy/archive/refs/tags/${PROXY_VERSION}.tar.gz`;

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function buildMacOS() {
  console.log('Building 3proxy for macOS...');
  const tmpDir = path.join(binDir, 'tmp');
  const tarFile = path.join(tmpDir, '3proxy.tar.gz');
  
  // Create temp directory
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  try {
    // Download source
    console.log('Downloading 3proxy source...');
    await downloadFile(DOWNLOAD_URL, tarFile);

    // Extract
    console.log('Extracting...');
    await execAsync(`tar -xzf ${tarFile} -C ${tmpDir}`);

    // Build
    const sourceDir = path.join(tmpDir, `3proxy-${PROXY_VERSION}`);
    console.log('Compiling for macOS...');
    await execAsync(`cd ${sourceDir} && make -f Makefile.unix`);

    // Copy binary
    const binarySource = path.join(sourceDir, 'bin', '3proxy');
    const binaryDest = path.join(binDir, '3proxy-darwin');
    fs.copyFileSync(binarySource, binaryDest);
    fs.chmodSync(binaryDest, 0o755);

    console.log('✓ macOS binary created:', binaryDest);
  } catch (error) {
    console.error('Error building macOS binary:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

async function buildWindows() {
  console.log('\n⚠️  Windows binary needs to be built on Windows or cross-compiled.');
  console.log('For now, please download from: https://github.com/3proxy/3proxy/releases');
  console.log(`Download version ${PROXY_VERSION} and place 3proxy.exe as resources/bin/3proxy-win32.exe`);
}

async function main() {
  console.log('=== 3proxy Binary Download Script ===\n');
  
  const platform = process.platform;
  
  if (platform === 'darwin') {
    await buildMacOS();
    await buildWindows();
  } else if (platform === 'win32') {
    console.log('Windows build not yet automated.');
    console.log('Please download from: https://github.com/3proxy/3proxy/releases');
    console.log(`Download version ${PROXY_VERSION} and place 3proxy.exe as resources/bin/3proxy-win32.exe`);
  } else {
    console.log('Linux build not yet implemented.');
  }

  console.log('\n✓ Done!');
}

main().catch(console.error);