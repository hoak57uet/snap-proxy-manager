---
description: Repository Information Overview
alwaysApply: true
---

# Snap Proxy Repository Guide

## Summary
Snap Proxy is an Electron-based desktop application built with React, TypeScript, and Vite. It delivers a modern React interface packaged for cross-platform desktop use.

## Structure
- **src/**: React application source code and assets.
- **electron/**: Electron main-process and preload scripts.
- **public/**: Static assets served with the application.
- **dist-electron/**: Compiled Electron output.
- **.zencoder/**: Configuration resources for Zencoder.

## Language & Runtime
- **Primary Languages**: TypeScript, JavaScript.
- **TypeScript Version**: 5.2.2.
- **Build System**: Vite 5.1.6.
- **Package Manager**: npm or yarn.

## Dependencies
- **Main Dependencies**:
  - react: ^18.2.0
  - react-dom: ^18.2.0
  - electron: ^30.0.1
- **Development Dependencies**:
  - typescript: ^5.2.2
  - vite: ^5.1.6
  - electron-builder: ^24.13.3
  - vite-plugin-electron: ^0.28.6
  - vite-plugin-electron-renderer: ^0.14.5
  - @vitejs/plugin-react: ^4.2.1
  - eslint: ^8.57.0

## Build & Installation
```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build
```

## Electron Configuration
- **Main Process Entry**: electron/main.ts.
- **Preload Script**: electron/preload.ts.
- **Packaging Configuration**: electron-builder.json5.
- **Distribution Targets**: Windows (NSIS), macOS (DMG), Linux (AppImage).

## Application Structure
- **Frontend Entry Point**: src/main.tsx.
- **Root Component**: src/App.tsx.
- **Electron Bootstrap**: electron/main.ts manages the application window.
- **Bundling**: Vite configured with Electron integration plugins.

## TypeScript Configuration
- **Target**: ES2020.
- **JSX Mode**: react-jsx.
- **Module System**: ESNext.
- **Strict Mode**: Enabled.
- **Included Paths**: src/ and electron/ directories.

## Cross-Platform Development Guidelines
- **Target Platforms**: Windows and macOS.
- **Development Requirements**:
  - Develop and test every feature on both Windows and macOS in parallel.
  - Favor platform-agnostic APIs and libraries whenever feasible.
  - When platform-specific logic is unavoidable, implement conditional handling for both platforms.
  - Verify UI components on each platform to maintain consistent appearance and behavior.
  - Use relative file paths to avoid platform-specific path issues.
  - Account for differences in file systems, path separators, and line endings across platforms.
  - Validate installation and packaging workflows on both platforms before release.
  - Record any platform-specific behavior or limitations in the project wiki.
- **Platform Considerations**:
  - **Windows**:
    - Test on Windows 10 and Windows 11.
    - Handle UAC prompts and Windows-specific file permissions.
    - Respect Windows keyboard shortcuts and UI conventions.
  - **macOS**:
    - Test on the latest supported macOS versions.
    - Align with Apple Human Interface Guidelines for macOS.
    - Implement proper code signing for distribution.
    - Support macOS-specific features when appropriate (for example, the Touch Bar and native menus).
- **Testing Requirements**:
  - Maintain testing environments for both Windows and macOS.
  - Confirm feature parity across platforms.
  - Document unavoidable platform-specific differences in the project wiki.