# Services Documentation

## SudoService

Service for executing commands with admin/sudo privileges while displaying the native authentication dialog.

### Packages Used
- **`@vscode/sudo-prompt`** (v9.3.1)
- Maintained by the VSCode team (Microsoft)
- Last updated: November 2024
- Downloads: ~363K/week

### Features
- ✅ Native authentication dialog on macOS (Touch ID / Password)
- ✅ Cross-platform support: macOS, Linux, Windows
- ✅ No need to type the password in the terminal
- ✅ Authentication dialog displays the app name: "Snap Proxy"

### API

#### `exec(command: string, options?: SudoOptions)`
Executes a command with sudo privileges.

```typescript
await sudoService.exec('ifconfig en0 inet6 add ...');
```

#### `execMultiple(commands: string[], options?: SudoOptions)`
Executes multiple commands with a single authentication flow.

```typescript
await sudoService.execMultiple([
  'ifconfig en0 inet6 add ...',
  'ifconfig en0 inet6 add ...'
]);
```

#### `checkSudoAccess()`
Checks whether sudo access is available.

```typescript
const hasAccess = await sudoService.checkSudoAccess();
```

### Platform-specific behavior

#### macOS
- Displays the native authentication dialog
- Supports Touch ID when available
- Falls back to password authentication if Touch ID fails

#### Linux
- Uses `pkexec` or `gksudo`
- Presents a GUI authentication dialog

#### Windows
- Uses UAC (User Account Control)
- Shows the Windows elevation dialog

## IPv6Service

Service for managing IPv6 addresses on network interfaces.

### Features
- Detect network interfaces with IPv6
- Add/Remove IPv6 addresses (using SudoService)
- Test IPv6 connectivity
- Generate random IPv6 addresses within a prefix

### API

#### `addIPv6ToInterface(interfaceName, ipv6, prefix)`
Adds an IPv6 address to the interface (requires sudo).

```typescript
await ipv6Service.addIPv6ToInterface('en0', '2001:db8::1', 64);
```

#### `removeIPv6FromInterface(interfaceName, ipv6, prefix)`
Removes an IPv6 address from the interface (requires sudo).

```typescript
await ipv6Service.removeIPv6FromInterface('en0', '2001:db8::1', 64);
```

## ProxyService

Service for managing proxy instances (HTTP/SOCKS5).

### Features
- Start/Stop individual proxies
- **Batch start multiple proxies** with a single authentication request
- Health check proxies
- Rotate IPv6 addresses
- Generate proxy URIs

### API

#### `startMultipleProxies(configs[])`
**⭐ Recommended** - Start multiple proxies with **one authentication prompt**.

```typescript
const proxies = await proxyService.startMultipleProxies([
  { id: 0, type: 'HTTP', port: 8080, ipv6: '2001:db8::1', ... },
  { id: 1, type: 'HTTP', port: 8081, ipv6: '2001:db8::2', ... },
  // ... 10 proxies
]);
// → Only a single authentication dialog appears!
```

#### `startProxy(id, type, port, ipv6, ...)`
Starts a single proxy (prompts for authentication every time).

```typescript
await proxyService.startProxy(0, 'HTTP', 8080, '2001:db8::1', 'en0', 64);
```

## Important Notes

### Authentication Dialog
- ✅ **Use `startMultipleProxies()`** to authenticate once for multiple proxies
- ❌ **Avoid calling `startProxy()` repeatedly** — each call triggers an additional dialog
- macOS may cache sudo credentials for ~5 minutes
- Users can cancel the dialog — the command will throw an error

### Error Handling
```typescript
try {
  await sudoService.exec('some command');
} catch (error) {
  // User canceled authentication or the command failed
  console.error('Failed:', error);
}
```

### Security
- Never hardcode passwords
- Validate commands before executing them
- Request sudo access only when absolutely necessary