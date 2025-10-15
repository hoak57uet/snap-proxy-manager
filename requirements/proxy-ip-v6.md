# 🧠 Screen: "IPv6 Proxy Manager" — Detailed Specification

## 🎯 Objectives
This screen allows users to create, manage, and use local **IPv6 proxies** based on the IPv6 `/64` range provided by the ISP. The application will:
- Automatically detect the current public IPv6 prefix.
- Allow the creation of **multiple local proxies** (HTTP/SOCKS5) — each proxy bound to a distinct IPv6 address.
- Support IP rotation manually or on a schedule; allow configuring full-pool rotation while keeping the listen ports unchanged.

---

## 🖼️ User Interface (UI Layout)

### 🧩 1. Header
| Component | Description |
|-----------|-------------|
| **App Title** | "IPv6 Proxy Manager" |
| **Status Indicator** | Show `🟢 Connected` if the machine has an IPv6 /64; `🔴 No IPv6 prefix` if nothing is detected |
| **Refresh Button** | `↻ Scan Network` button to rescan the current IPv6 prefix |

---

### 🌐 2. Network Info Section
**Purpose:** display the current IPv6 network information and prefix.

| Field | Description |
|-------|-------------|
| **Interface** | Dropdown listing available interfaces (`en0`, `en1`, `eth0`, etc.) |
| **Detected IPv6** | Current public IPv6, e.g., `2405:4802:1fe:f7d0:e816:ffa4:66e2:c383` |
| **Prefix** | `/64` (or `/56`, `/128` if the ISP provides something else) |
| **Prefix Base** | Example: `2405:4802:1fe:f7d0::/64` |
| **Check Connectivity** | `Test Ping` button → run `ping6 google.com` over IPv6 to verify |

---

### 🧱 3. Proxy Configuration Section
**Purpose:** allow users to create or delete local proxies. This section includes the requested additions (number of proxies, username/password, rotation interval for the full proxy pool while keeping the listen ports).

**UI fields & controls**
- **Proxy Type**: Radio button: `HTTP` / `SOCKS5`
- **Number of Proxies**: Numeric input (min 1, max configurable, e.g., up to 1000) — describes how many proxy instances will be created automatically.
- **Listen Port Start**: Numeric input (e.g., 30000) — the application creates consecutive proxies on ports `Start`, `Start+1`, ... `Start+N-1`. (These listen ports remain unchanged when the entire pool rotates.)
- **Username**: Text input — username for authentication (optional). Leave blank → no authentication.
- **Password**: Password input (hidden) — if provided, enable basic/cleartext or digest authentication depending on the engine.
- **Bind IPv6 Address (per proxy)**: Options
    - `Auto-generate from Prefix` (default): the app randomly generates `N` IPv6 addresses within the prefix.
    - `Manual list`: the user pastes a list of desired IPv6 addresses (N lines — if fewer than the number of proxies, the app auto-generates the remainder).
- **Rotation Mode**: Dropdown: `Manual` / `Interval` / `Per Request`
- **Rotation Interval (sec)**: Numeric input, displayed only when `Interval` is selected — describes how often the entire pool rotates (see logic section).
- **Start/Stop Buttons**: `Start Proxies`, `Stop All`
- **Preview**: `Preview Plan` button — display a table of planned proxies (Port, IPv6, Auth)

**UX notes**
- When the user enters `Number of Proxies = N` and `Listen Port Start = P`, the app plans N proxies on ports `P..P+N-1`.
- When the user provides `Username/Password`, the app applies authentication to all proxies; optionally add a `unique credentials per proxy` checkbox to auto-generate credentials per instance.

---

### 🧩 4. Proxy List Table
**Purpose:** display all running proxies and their bound IPv6 addresses.

| Column | Description |
|--------|-------------|
| **Proxy ID** | Sequential number |
| **Type** | HTTP / SOCKS5 |
| **Listen Port** | Example: 3128 or 30000..30099 |
| **Bound IPv6** | Specific IPv6, e.g., `2405:4802:1fe:f7d0::abcd` |
| **Username** | (if any) |
| **Status** | Running / Stopped |
| **Last Rotated** | Timestamp when this IP was last assigned/rotated |
| **Actions** | Buttons `Stop`, `Rotate` (rotate a single proxy), `Copy` (copy proxy URI), `Show Logs` |

---

### 🧩 5. Rotation Control Panel
**Purpose:** configure and trigger full-pool rotation for all proxies.

Fields:
- **Rotation Mode (Global)**: `Manual` / `Interval` / `Per Request` (mirrors configuration but at global scope)
- **Rotate Full Pool Every**: Time input (seconds/minutes/hours) — *new requirement*: the duration after which **all proxies rotate while keeping their listen ports**.
    - Example: `Rotate Full Pool Every: 3600 sec` ⇒ Every 3600 seconds, all N proxies get new IPv6 addresses while continuing to listen on ports `P..P+N-1`.
- **Staggering Option**: Checkbox plus `stagger X sec` input to prevent all proxies from rotating simultaneously — the app staggers per proxy by X seconds.
- **Graceful Switch**: `Graceful` checkbox — instead of kill-and-recreate, the app assigns the new IPv6, starts a new process bound to the same port, waits for active connections to drain (configurable timeout), and then stops the old process.
- **Immediate Rotate Now**: `Rotate Now` button to trigger a full-pool rotation immediately.

---

### 🧩 6. Logs & Console
**Purpose:** display real-time logs.

| Log type | Example |
|----------|---------|
| ✅ Info | `Proxy 3128 started at [2405:4802:1fe:f7d0::abcd]` |
| ⚠️ Warning | `IPv6 2405:4802:1fe:f7d0::abcd not reachable` |
| 🔁 Rotation | `Rotated proxy 3128 → [2405:4802:1fe:f7d0::dcba]` |
| ❌ Error | `Failed to bind socket on port 3128` |

- Filter logs by level (Error/Warning/Info) and by Proxy ID.
- Export logs to `.txt`/`.json`.

---

## 🧠 Logic & Workflow Details (updated per requirements)

### 1️⃣ Application Startup
- The application automatically scans active interfaces (macOS: `ifconfig`, Linux: `ip -6 addr`).
- Locate IPv6 addresses with `prefixlen ≤ 64`.
- If a `/64` is available → set status to `Connected`.
- If only `/128` is found → warn "Cannot create multiple IPv6 addresses."

### 2️⃣ Planning N Proxies
When the user configures `Number of Proxies = N` and `Listen Port Start = P`, then clicks `Preview Plan`:
- The app prepares a draft table with N rows: port `P+i`, IPv6 (from manual list or generated), username/password (if provided).
- IPv6 generation: random suffix function within the prefix base. Optionally includes collision avoidance with existing addresses.

### 3️⃣ Creating & Running Proxies (Start Proxies)
For each planned proxy `i` in 0..N-1:
1. If the IPv6 address has not been assigned to the interface → assign it via system command (macOS example):
   ```bash
   sudo ifconfig <interface> inet6 <ipv6> prefixlen 64 add
   ```
2. Start the proxy process (engine) bound to `127.0.0.1` (or `::1`) listening on port `P+i`, and configure the outgoing source address using `-e <ipv6>` or equivalent. Example with 3proxy: `proxy -6 -p<P+i> -i127.0.0.1 -e<ipv6>`.
3. Mark the status as `Running` and store the PID.
4. Execute a health check: `curl -6 --proxy http://127.0.0.1:<P+i> https://ifconfig.co` and verify the returned IP equals `<ipv6>`.

If `Username/Password` is provided:
- Generate a common authentication config for all proxies or auto-generate per-proxy credentials when the user selects `unique credentials`.

### 4️⃣ Full-Pool Rotation (ports remain unchanged)
**Definition:** "Full-pool rotation" means **each proxy continues listening on its original port**, but the outbound IPv6 address changes to a new one within the prefix.

**Algorithm (Interval mode)**
- Scheduler runs every `T` seconds (T = user-configured Rotate Full Pool Every).
- When a full-pool rotation is triggered:
    1. If `Stagger` is ON, order proxies by ID and schedule each proxy rotation at `t + i * stagger_sec`.
    2. For each proxy:
        - Generate a new IPv6 `new_ip` (ensure it does not collide with other active addresses).
        - `sudo ifconfig <iface> inet6 <new_ip> prefixlen 64 add` (if absent).
        - If `Graceful` is enabled:
          a. Start a new proxy process bound to the same listen port `P+i` but configured to use `new_ip` for outbound traffic.
          b. The new process should bind to the same listen port — to avoid EADDRINUSE, the app should implement socket handover: either (preferred) start the proxy on a temporary port, transfer connections, or rely on proxy engine capabilities for hot-swapping source addresses. If the engine cannot hot-swap, use a short drain: mark the old process as `Draining` (stop accepting new connections, wait for `drain_timeout`), then start the new process on the same port after the old one exits.
        - If `Graceful` is disabled:
          a. Stop the old process.
          b. Start a new process on the same port with `-e new_ip`.
        - Run a health check for the proxy to confirm the outbound IP has changed.
        - Optionally remove the old IPv6 from the interface after a safe period: `sudo ifconfig <iface> inet6 <old_ip> delete`.

**Notes on atomicity & collision:**
- Ensure generated IPv6 addresses are not used by other proxies at the same time. Maintain a central registry.
- If `Per Request` rotation mode is selected: implement routing logic that rewrites the source per outbound connection (complex — may require a custom proxy engine). A simpler approach is to pre-bind a large set of IPv6 addresses and configure the proxy engine to round-robin them or spawn worker processes per source.

### 5️⃣ Health Checks
- After each rotation/start action, run `curl -6` through the proxy to `https://ifconfig.co` and verify the returned IP matches the bound IPv6.
- If the health check fails, retry N times with backoff. If it still fails, mark the proxy as `Error` and emit an alert.

### 6️⃣ Credential & Security Handling
- Store passwords securely (OS keychain recommended) and avoid logging secrets.
- When the user inputs `Username/Password`, apply them to the proxy engine; if the engine stores plaintext, recommend hashed storage.

### 7️⃣ Persistence & Recovery
- Save the plan (ports, last-known IPv6, credential configuration, rotation settings) to disk (e.g., JSON config).
- On app restart, load the config and reconcile — start proxies that were `Running`, reassign IPv6 addresses if missing.

---

## 🧭 Key Behavior Summary (User Flow)
```text
Open app → Scan IPv6 → Display prefix /64 →
Enter Number of Proxies N, Listen Port Start P, Username, Password → Preview Plan → Start Proxies →
Verify outbound IP for each proxy → Enable full-pool rotation on interval T or rotate manually → Monitor logs & status
```

---

## 🎨 UX/UI Suggestions
- **Style:** Default dark mode, “hacker green” or “tech blue” tone.
- **Font:** JetBrains Mono / Fira Code.
- **IPv6 display:** show in shortened form, reveal full address on hover.
- **Animations:** smooth transitions when proxies start/stop or rotate.

---

## 🧰 Technical Integration (Suggestions)
| Component | Suggested Technology |
|-----------|----------------------|
| UI | Electron + React / Tauri + Svelte |
| Local backend | Node.js (use `child_process` to call `ifconfig` / spawn proxy processes) |
| Proxy engine | 3proxy / TinyProxy / Custom Python proxy |
| IPv6 generator | Random 64-bit suffix within the `/64` prefix |
| Logs | Winston or a custom logger, stored as JSON |
| Connectivity tests | `curl -6 https://ifconfig.co` or `ping6 google.com` |

---

## 🔒 System Permissions
The application requires `sudo` (or elevated privileges) to:
- Add/remove IPv6 addresses on the interface.
- Bind sockets to specific IPv6 addresses.
  Suggested UX: prompt on first run to store credentials (similar to Homebrew or Docker Desktop).

---

## ⚠️ Risks & Recommendations
- Assigning too many IPv6 addresses at once can fill the router’s neighbor cache — stagger additions/removals.
- Throttle the rate of creation/rotation to avoid ISP or router blocks.
- Store credentials securely; do not log passwords.

---

*Document version: 1.0*