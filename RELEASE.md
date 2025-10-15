# Release Process

This document outlines the release process for Snap Proxy Manager.

## Prerequisites

### For macOS builds:
- Xcode Command Line Tools installed
- Apple Developer account with valid certificates
- Environment variables set:
  - `APPLE_ID`: Your Apple ID email
  - `APPLE_ID_PASSWORD`: App-specific password
  - `APPLE_TEAM_ID`: Your Apple Developer Team ID

### For Windows builds:
- Code signing certificate (`.p12` file)
- Environment variables set:
  - `WIN_CSC_LINK`: Path to certificate file
  - `WIN_CSC_KEY_PASSWORD`: Certificate password

### For Linux builds:
- No special requirements

## Build Commands

### Development Build
```bash
npm run build:dev
```

### Production Build
```bash
npm run build:prod
```

### Platform-specific builds
```bash
npm run dist:mac     # macOS only
npm run dist:win     # Windows only  
npm run dist:linux   # Linux only
```

### Using build script
```bash
# Build for current platform
node scripts/build-release.js

# Build for specific platform
node scripts/build-release.js mac
node scripts/build-release.js win
node scripts/build-release.js linux

# Development build
node scripts/build-release.js --dev
```

## Version Management

### Bump version
```bash
# Patch version (1.0.0 -> 1.0.1)
node scripts/version-bump.js patch

# Minor version (1.0.0 -> 1.1.0)
node scripts/version-bump.js minor

# Major version (1.0.0 -> 2.0.0)
node scripts/version-bump.js major

# Specific version
node scripts/version-bump.js 1.2.3

# With git tag and push
node scripts/version-bump.js patch --tag --push
```

## Release Process

### Manual Release

1. **Prepare release**
   ```bash
   # Update version
   node scripts/version-bump.js patch --tag
   
   # Build for all platforms
   npm run build:prod
   ```

2. **Test builds**
   - Test on target platforms
   - Verify functionality
   - Check code signing

3. **Create GitHub release**
   - Push tags: `git push --tags`
   - Create release on GitHub
   - Upload build artifacts

### Automated Release (GitHub Actions)

1. **Create release tag**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. **GitHub Actions will automatically:**
   - Build for all platforms
   - Sign applications
   - Create GitHub release
   - Upload artifacts

## Build Outputs

### macOS
- `Snap Proxy Manager-Mac-{version}-x64.dmg`
- `Snap Proxy Manager-Mac-{version}-arm64.dmg`
- `Snap Proxy Manager-Mac-{version}-x64.zip`
- `Snap Proxy Manager-Mac-{version}-arm64.zip`

### Windows
- `Snap Proxy Manager-Windows-{version}-x64-Setup.exe`
- `Snap Proxy Manager-Windows-{version}-ia32-Setup.exe`
- `Snap Proxy Manager-Windows-{version}-x64-Portable.exe`

### Linux
- `Snap Proxy Manager-Linux-{version}-x64.AppImage`
- `Snap Proxy Manager-Linux-{version}-x64.deb`
- `Snap Proxy Manager-Linux-{version}-x64.rpm`

## Code Signing

### macOS
- Requires Apple Developer certificate
- Automatic notarization enabled
- Hardened runtime enabled

### Windows
- Requires code signing certificate
- Supports both EV and standard certificates
- Timestamp server configured

## Troubleshooting

### Common Issues

1. **Build fails on macOS**
   - Check Xcode Command Line Tools: `xcode-select --install`
   - Verify certificates in Keychain
   - Check environment variables

2. **Windows signing fails**
   - Verify certificate file path
   - Check certificate password
   - Ensure certificate is not expired

3. **Binary download fails**
   - Check internet connection
   - Verify 3proxy version in download script
   - Manual download may be required

### Debug Build
```bash
# Enable debug output
DEBUG=electron-builder npm run build

# Verbose logging
npm run build -- --publish=never --config.compression=store
```

## Security Notes

- Never commit certificates or passwords
- Use environment variables for sensitive data
- Rotate certificates before expiration
- Keep signing keys secure

## Support

For build issues, check:
1. This documentation
2. GitHub Issues
3. Electron Builder documentation
4. Platform-specific signing guides