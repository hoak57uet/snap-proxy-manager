#!/usr/bin/env node

/**
 * Version bump script for releases
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');

function log(message) {
  console.log(`[VERSION] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
}

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function updateVersion(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

function bumpVersion(type) {
  const currentVersion = getCurrentVersion();
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    default:
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        newVersion = type;
      } else {
        error(`Invalid version type: ${type}`);
        process.exit(1);
      }
  }
  
  return newVersion;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    error('Usage: node version-bump.js <major|minor|patch|x.y.z> [--tag] [--push]');
    process.exit(1);
  }
  
  const versionType = args[0];
  const shouldTag = args.includes('--tag');
  const shouldPush = args.includes('--push');
  
  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(versionType);
  
  log(`Current version: ${currentVersion}`);
  log(`New version: ${newVersion}`);
  
  // Update package.json
  updateVersion(newVersion);
  log('Updated package.json');
  
  // Git operations
  try {
    execSync('git add package.json', { cwd: projectRoot });
    execSync(`git commit -m "chore: bump version to ${newVersion}"`, { cwd: projectRoot });
    log('Committed version change');
    
    if (shouldTag) {
      execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { cwd: projectRoot });
      log(`Created tag v${newVersion}`);
    }
    
    if (shouldPush) {
      execSync('git push', { cwd: projectRoot });
      if (shouldTag) {
        execSync('git push --tags', { cwd: projectRoot });
      }
      log('Pushed changes to remote');
    }
    
    log('✅ Version bump completed!');
    
  } catch (err) {
    error('Git operations failed:');
    error(err.message);
    process.exit(1);
  }
}

main();