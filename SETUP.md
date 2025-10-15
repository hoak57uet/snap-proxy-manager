# IPv6 Proxy Manager - Setup Guide

## Prerequisites

### 1. 3proxy Binary (Automatic)

The application now **automatically bundles** the 3proxy binary!

- **macOS**: The binary is automatically built during `npm install`
- **Windows**: You need to manually download the binary (see below)

#### For Windows Users Only
If you are developing on Windows, manually add the Windows binary:

1. Download 3proxy from: https://github.com/3proxy/3proxy/releases/tag/0.9.4
2. Extract `3proxy.exe` from the archive
3. Place it as `resources/bin/3proxy-win32.exe` in the project directory

**Note**: The app works without a system-wide 3proxy installation. The bundled binary is used automatically.

### 2. Set up the IPv6 Network

#### Check whether you have an IPv6 /64 prefix
```bash
# macOS/Linux
ifconfig | grep inet6

# Windows
ipconfig | findstr IPv6
```

You should see a global IPv6 address (not starting with `fe80::`).

#### Request an IPv6 /64 from your ISP
Most ISPs provide an IPv6 /64 prefix by default. Contact your ISP if you do not have one.

### 3. Grant sudo permissions (macOS/Linux)

The app requires sudo access to add/remove IPv6 addresses. You have two options:

#### Option A: Run the app with sudo (simple)
```bash
sudo npm run dev
```

#### Option B: Configure passwordless sudo for specific commands (recommended)
```bash
# Edit sudoers file
sudo visudo

# Add these lines (replace YOUR_USERNAME):
YOUR_USERNAME ALL=(ALL) NOPASSWD: /sbin/ifconfig
YOUR_USERNAME ALL=(ALL) NOPASSWD: /sbin/ip
```

## Installation

1. Clone the repository
```bash
git clone <repo-url>
cd snap-proxy
```

2. Install dependencies
```bash
npm install
```

3. Run in development mode
```bash
npm run dev
```

4. Build for production
```bash
npm run build
```

## Usage

1. **Scan Network**: Click "Scan Network" to detect IPv6 interfaces
2. **Select Interface**: Choose the interface with the IPv6 /64 prefix
3. **Configure Proxies**:
   - Select proxy type (HTTP/SOCKS5)
   - Specify the number of proxies
   - Set the starting port
   - Optional: Add username/password for authentication
4. **Preview Plan**: Click "Preview Plan" to inspect the configuration
5. **Start Proxies**: Click "Start Proxies" to launch the proxy instances
6. **Configure Rotation**: Choose the rotation mode and interval
7. **Monitor**: Observe logs and proxy status in real time

## Troubleshooting

### "No IPv6 prefix detected"
- Verify that your ISP provides IPv6
- Ensure your router has IPv6 enabled
- Review firewall settings

### "Failed to bind socket"
- The port may be in use
- Try a different port range
- Ensure you have permission to bind to the ports

### "Permission denied" when adding IPv6
- Run with sudo (macOS/Linux)
- Configure passwordless sudo (see above)
- Run as Administrator (Windows)

### 3proxy not found
- The binary should be automatically downloaded during `npm install`
- Confirm the presence of `resources/bin/3proxy-darwin` (macOS) or `resources/bin/3proxy-win32.exe` (Windows)
- Try running `npm run download-binaries`
- For Windows, manually download and place the binary as described above

### Health check failures
- Verify IPv6 connectivity: `ping6 google.com`
- Confirm the proxy is running: `netstat -an | grep <port>`
- Review firewall rules

## Security Notes

- Store credentials securely
- Use strong passwords for proxy authentication
- Do not expose proxy ports to the public internet
- Monitor logs for suspicious activity
- Rotate IPs regularly

## Performance Tips

- Use staggered rotation to avoid network spikes
- Enable graceful rotation for zero downtime
- Monitor system resources (CPU, memory, network)
- Limit the number of concurrent proxies based on your system

## Support

For issues and questions, please open a GitHub issue.