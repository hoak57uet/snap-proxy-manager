# Resources Directory

This directory contains bundled binaries for the application.

## 3proxy Binaries

The application automatically downloads and builds the 3proxy binary for macOS during `npm install`.

### For macOS Development
The binary is automatically built when you run:
```bash
npm install
# or
npm run download-binaries
```

### For Windows Development
To build the Windows binary, you need to:

1. **Option A: Download pre-built binary**
   - Go to https://github.com/3proxy/3proxy/releases
   - Download version 0.9.4 for Windows
   - Extract `3proxy.exe` from the archive
   - Place it as `resources/bin/3proxy-win32.exe`

2. **Option B: Build from source on Windows**
   - Download source from https://github.com/3proxy/3proxy/releases/tag/0.9.4
   - Extract and open in Visual Studio or MinGW
   - Build using `make -f Makefile.msvc` or `make -f Makefile.mingw`
   - Copy `bin/3proxy.exe` to `resources/bin/3proxy-win32.exe`

### Binary Naming Convention
- macOS: `3proxy-darwin`
- Windows: `3proxy-win32.exe`
- Linux: `3proxy-linux` (not yet implemented)

## .gitignore
The binaries are ignored by git (except for the directory structure) to keep the repository size small. They are automatically downloaded/built during installation.