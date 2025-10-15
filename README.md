# <img src="build/icon-64.png" alt="Snap Proxy Logo" width="30" /> IPv6 Proxy Manager

A local IPv6 proxy management application with automatic rotation capabilities, supporting both macOS and Windows.

![Status](https://img.shields.io/badge/status-ready-brightgreen) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue) ![License](https://img.shields.io/badge/license-MIT-green) [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%E2%98%95-FFDD00?logo=paypal&logoColor=003087)](https://www.paypal.com/paypalme/alanpham194/)

![Application Screenshot](img/screenshot.png)

## ✨ Features

### 🎯 Core Features
- ✅ **Automatically detects the IPv6 /64 prefix** from your ISP
- ✅ **Creates multiple proxies at once** (HTTP/SOCKS5) with sequential ports
- ✅ **Binds each proxy to a unique IPv6 address** within the prefix
- ✅ **Automatic rotation** with multiple modes:
  - Manual: Rotate on demand
  - Interval: Rotate based on a time schedule
  - Staggered: Rotate with an offset to avoid spikes
- ✅ **Graceful rotation**: Zero downtime when changing IPs
- ✅ **Health checks**: Verify outbound IP through each proxy
- ✅ **Authentication**: Username/Password per proxy
- ✅ **Real-time logs**: Monitor activity live

### 🎨 UI/UX
- 🌑 Dark mode with a "hacker green" theme
- 🔤 JetBrains Mono font
- 📊 Intuitive dashboard powered by Ant Design
- 🔄 Smooth animations
- 📋 Copy proxy URI with a single click
- 🔍 Filter and search logs

### 🖥️ Cross-Platform
- ✅ **macOS**: Fully supported
- ✅ **Windows**: Fully supported
- ✅ **Linux**: Supported (not extensively tested yet)

## 📋 System Requirements

### Mandatory
1. **IPv6 /64 prefix** from your ISP
2. **3proxy** binary ([Installation guide](./SETUP.md))
3. **Node.js** >= 18.x
4. **Admin/sudo privileges** (to add IPv6 addresses to the interface)

### Check IPv6 Availability
```bash
# macOS/Linux
ifconfig | grep inet6

# Windows
ipconfig | findstr "IPv6"
```

You should see a public IPv6 address (not `fe80::` or `::1`).

## 🚀 Installation

### 1. Clone the repository
```bash
git clone <repo-url>
cd snap-proxy
```

### 2. Install dependencies
```bash
npm install
```

### 3. Install 3proxy
See detailed instructions in [SETUP.md](./SETUP.md)

**macOS (Homebrew):**
```bash
brew install 3proxy
```

**Windows:**
- Download from [3proxy.org](https://3proxy.org/)
- Extract and add the binary to your PATH

### 4. Run the application

**Development mode:**
```bash
npm run dev
```

**Production build:**
```bash
npm run build
```

## 📖 User Guide

### Step 1: Scan network
1. Launch the app
2. Click the **"↻ Scan Network"** button
3. Select the interface that has IPv6 (commonly `en0` on macOS, `Ethernet` on Windows)
4. Confirm the **Prefix Base** (for example: `2405:4802:1fe:f7d0::/64`)

### Step 2: Configure proxies
1. Select **Proxy Type**: HTTP or SOCKS5
2. Enter **Number of Proxies**: How many proxies to create (1-1000)
3. Enter **Listen Port Start**: Starting port (e.g., 30000)
4. *(Optional)* Enter **Username/Password** for authentication
5. *(Optional)* Enter a manual list of IPv6 addresses or let the app generate them
6. Click **"Preview Plan"** to review the plan
7. Click **"Start Proxies"** to launch the proxies

### Step 3: Configure rotation
1. Choose **Rotation Mode**:
   - **Manual**: Rotate using the "Rotate Now" button
   - **Interval**: Rotate automatically at a specified interval
2. If Interval is selected:
   - Enter **Interval (seconds)**: Time between rotations
   - Enable **Stagger** to rotate proxies out of phase (avoids spikes)
   - Enable **Graceful** for zero-downtime rotations
3. Click **"Apply"** to save the configuration

### Step 4: Use proxies
Copy a proxy URI from the Proxy List table:
```
http://username:password@127.0.0.1:30000
```

Use it in code:
```javascript
// Node.js
const axios = require('axios');
const response = await axios.get('https://ifconfig.co', {
  proxy: {
    host: '127.0.0.1',
    port: 30000,
    auth: {
      username: 'your-username',
      password: 'your-password'
    }
  }
});
console.log(response.data); // IPv6 reported by the proxy
```

```python
# Python
import requests
proxies = {
    'http': 'http://username:password@127.0.0.1:30000',
    'https': 'http://username:password@127.0.0.1:30000'
}
response = requests.get('https://ifconfig.co', proxies=proxies)
print(response.text)  # IPv6 reported by the proxy
```

## 🔧 Advanced Features

### Graceful Rotation
When **Graceful rotation** is enabled:
1. The app creates a new proxy with a new IPv6 address
2. The old proxy switches to "draining" (no new connections)
3. The app waits for existing connections to finish
4. The old proxy stops and the old IPv6 is removed
5. **Zero downtime achieved!**

### Staggered Rotation
When **Stagger** is enabled:
- Instead of rotating all proxies simultaneously
- The app rotates each proxy with a delay between them
- Prevents network spikes and sudden load

### Health Check
Click the **"Health Check"** button to:
- Confirm the proxy is reachable
- Verify the outbound IP matches the bound IPv6
- Validate authentication

### Logs & Monitoring
- **Filter by level**: Info, Warning, Error, Rotation
- **Search**: Search within logs
- **Export**: Export logs as JSON
- **Real-time**: Logs update live

## 🏗️ Architecture

```
snap-proxy/
├── electron/               # Electron main process
│   ├── main.ts            # IPC handlers
│   └── services/
│       ├── ipv6Service.ts    # IPv6 management
│       ├── proxyService.ts   # 3proxy lifecycle
│       └── rotationService.ts # Rotation scheduler
├── src/                   # React renderer
│   ├── App.tsx           # Main component
│   ├── components/       # UI components
│   ├── hooks/            # Custom hooks
│   └── types/            # TypeScript types
└── SETUP.md              # Setup guide
```

### Tech Stack
- **Frontend**: React + TypeScript + Ant Design
- **Backend**: Electron + Node.js
- **Proxy Engine**: 3proxy
- **Build**: Vite + electron-builder

## 🐛 Troubleshooting

### App does not detect IPv6
**Cause**: ISP has not provided IPv6 or the interface lacks IPv6
**Fix**:
1. Verify your ISP supports IPv6
2. Restart your router/modem
3. Check your network settings

### Unable to start proxy
**Cause**: Port already in use or missing admin rights
**Fix**:
1. Choose a different starting port
2. Run the app with admin/sudo privileges
3. Ensure 3proxy is installed

### Health check failed
**Cause**: IPv6 unreachable or proxy misconfigured
**Fix**:
1. Test IPv6 by running `ping6 google.com`
2. Review firewall settings
3. Verify the 3proxy configuration

### Rotation not working
**Cause**: Insufficient permissions to add/remove IPv6 addresses
**Fix**:
1. Run the app with sudo/admin rights
2. Inspect logs for specific errors

## 📝 Current Limitations

1. **Per-Request Rotation**: Not implemented yet (requires a custom proxy engine)
2. **Bandwidth Monitoring**: No detailed metrics available yet
3. **Proxy Templates**: Saving/loading configurations is not implemented
4. **Remote Management**: Web dashboard not available yet

## 🔮 Roadmap

- [ ] Per-request rotation with a custom proxy engine
- [ ] Bandwidth and latency monitoring
- [ ] Save/load proxy templates
- [ ] IPv6 blacklist/whitelist
- [ ] Docker support
- [ ] Web dashboard for remote management
- [ ] API for programmatic control
- [ ] Auto-update mechanism

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

## 📄 License

MIT License - see the LICENSE file for details.

## 🙏 Credits

- **3proxy**: Lightweight proxy server
- **Ant Design**: UI component library
- **Electron**: Cross-platform desktop framework

## 📞 Support

If you encounter issues, please:
1. Check [SETUP.md](./SETUP.md)
2. Review [IMPLEMENTATION.md](./IMPLEMENTATION.md) for details
3. Open an issue on GitHub

## 📫 Contact

Feel free to reach out via email: `alanpham194@gmail.com`.


[![Buy me a coffee with PayPal](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-☕-FFDD00?style=for-the-badge&logo=paypal&logoColor=003087)](https://www.paypal.com/paypalme/alanpham194/)

---