import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ipv6Service } from './ipv6Service';

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

export interface ProxyInstance {
  id: number;
  type: 'HTTP' | 'SOCKS5';
  port: number;
  ipv6: string;
  lanIp?: string;
  username?: string;
  password?: string;
  status: 'running' | 'stopped' | 'error' | 'draining';
  pid?: number;
  process?: ChildProcess;
  configPath?: string;
  lastRotated?: Date;
  healthCheckStatus?: 'healthy' | 'unhealthy' | 'checking';
}

export class ProxyService {
  private proxies: Map<number, ProxyInstance> = new Map();
  private configDir: string;
  private proxyBinaryPath: string = '';

  constructor() {
    this.configDir = path.join(os.tmpdir(), 'snap-proxy-configs');
    this.ensureConfigDir();
    this.detectProxyBinary();
  }

  private ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private detectProxyBinary() {
    // Try to find 3proxy binary
    const platform = os.platform();
    
    // First, try bundled binary (for production)
    const bundledPaths = this.getBundledBinaryPaths();
    for (const p of bundledPaths) {
      if (fs.existsSync(p)) {
        console.log(`Found bundled 3proxy binary at: ${p}`);
        this.proxyBinaryPath = p;
        // Ensure it's executable
        try {
          fs.chmodSync(p, 0o755);
        } catch (error) {
          console.warn('Could not set executable permission:', error);
        }
        return;
      }
    }

    // Fallback to system-installed binary
    const systemPaths = [
      '/usr/local/bin/3proxy',
      '/usr/bin/3proxy',
      'C:\\Program Files\\3proxy\\3proxy.exe',
      path.join(process.cwd(), '3proxy'),
      path.join(process.cwd(), '3proxy.exe'),
    ];

    for (const p of systemPaths) {
      if (fs.existsSync(p)) {
        console.log(`Found system 3proxy binary at: ${p}`);
        this.proxyBinaryPath = p;
        return;
      }
    }

    // If not found, assume it's in PATH
    console.warn('3proxy binary not found in bundled or system paths, assuming it\'s in PATH');
    this.proxyBinaryPath = platform === 'win32' ? '3proxy.exe' : '3proxy';
  }

  private getBundledBinaryPaths(): string[] {
    const platform = os.platform();
    const paths: string[] = [];

    // In development mode
    const devPath = platform === 'win32' 
      ? path.join(process.cwd(), 'resources', 'bin', '3proxy-win32.exe')
      : path.join(process.cwd(), 'resources', 'bin', `3proxy-${platform}`);
    paths.push(devPath);

    // In production (packaged app)
    // process.resourcesPath is available in packaged Electron apps
    if (process.resourcesPath) {
      const prodPath = platform === 'win32'
        ? path.join(process.resourcesPath, 'bin', '3proxy-win32.exe')
        : path.join(process.resourcesPath, 'bin', `3proxy-${platform}`);
      paths.push(prodPath);
    }

    // Alternative production path
    const altProdPath = platform === 'win32'
      ? path.join(path.dirname(process.execPath), 'resources', 'bin', '3proxy-win32.exe')
      : path.join(path.dirname(process.execPath), 'resources', 'bin', `3proxy-${platform}`);
    paths.push(altProdPath);

    return paths;
  }

  /**
   * Generate 3proxy configuration file
   */
  private async generateProxyConfig(proxy: ProxyInstance): Promise<string> {
    const configPath = path.join(this.configDir, `proxy-${proxy.id}.cfg`);
    
    let config = `# 3proxy configuration for proxy ${proxy.id}\n`;
    config += `nserver 8.8.8.8\n`;
    config += `nscache 65536\n`;
    config += `timeouts 1 5 30 60 180 1800 15 60\n`;
    
    // Authentication
    if (proxy.username && proxy.password) {
      config += `users ${proxy.username}:CL:${proxy.password}\n`;
      config += `auth strong\n`;
    } else {
      config += `auth none\n`;
    }
    
    // Allow all
    config += `allow *\n`;
    
    // Bind to specific IPv6 for outbound
    config += `external ${proxy.ipv6}\n`;
    
    // Proxy service with IPv6 binding
    // -6 forces IPv6, -e specifies external address
    if (proxy.type === 'HTTP') {
      config += `proxy -6 -p${proxy.port} -i127.0.0.1 -e${proxy.ipv6}\n`;
    } else {
      config += `socks -6 -p${proxy.port} -i127.0.0.1 -e${proxy.ipv6}\n`;
    }
    
    await writeFileAsync(configPath, config);
    return configPath;
  }

  /**
   * Start a proxy instance
   */
  async startProxy(
    id: number,
    type: 'HTTP' | 'SOCKS5',
    port: number,
    ipv6: string,
    interfaceName: string,
    prefix: number,
    username?: string,
    password?: string
  ): Promise<ProxyInstance> {
    // Check if proxy already exists
    if (this.proxies.has(id)) {
      throw new Error(`Proxy ${id} already exists`);
    }

    // Add IPv6 to interface
    await ipv6Service.addIPv6ToInterface(interfaceName, ipv6, prefix);

    // Detect LAN IPv4 address
    const lanIp = ipv6Service.detectLanIPv4();

    // Create proxy instance
    const proxy: ProxyInstance = {
      id,
      type,
      port,
      ipv6,
      lanIp,
      username,
      password,
      status: 'stopped',
      lastRotated: new Date(),
    };

    // Generate config
    const configPath = await this.generateProxyConfig(proxy);
    proxy.configPath = configPath;

    // Start 3proxy process
    try {
      const process = spawn(this.proxyBinaryPath, [configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      proxy.process = process;
      proxy.pid = process.pid;
      proxy.status = 'running';

      // Handle process events
      process.on('error', (error) => {
        console.error(`Proxy ${id} error:`, error);
        proxy.status = 'error';
      });

      process.on('exit', (code) => {
        console.log(`Proxy ${id} exited with code ${code}`);
        if (proxy.status !== 'draining') {
          proxy.status = 'stopped';
        }
      });

      // Log output
      process.stdout?.on('data', (data) => {
        console.log(`Proxy ${id} stdout:`, data.toString());
      });

      process.stderr?.on('data', (data) => {
        console.error(`Proxy ${id} stderr:`, data.toString());
      });

      this.proxies.set(id, proxy);

      // Wait a bit for proxy to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Health check with retry
      await this.healthCheckWithRetry(id, 3, 2000);

      return proxy;
    } catch (error) {
      proxy.status = 'error';
      throw error;
    }
  }

  /**
   * Stop a proxy instance
   */
  async stopProxy(id: number, graceful: boolean = false, drainTimeout: number = 30000): Promise<void> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      throw new Error(`Proxy ${id} not found`);
    }

    if (graceful) {
      proxy.status = 'draining';
      // Wait for drain timeout
      await new Promise(resolve => setTimeout(resolve, drainTimeout));
    }

    // Kill process
    if (proxy.process && proxy.pid) {
      try {
        proxy.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force kill if still running
        if (!proxy.process.killed) {
          proxy.process.kill('SIGKILL');
        }
      } catch (error) {
        console.error(`Error killing proxy ${id}:`, error);
      }
    }

    // Clean up config file
    if (proxy.configPath) {
      try {
        await unlinkAsync(proxy.configPath);
      } catch (error) {
        console.warn(`Failed to delete config file:`, error);
      }
    }

    proxy.status = 'stopped';
    proxy.process = undefined;
    proxy.pid = undefined;
  }

  /**
   * Rotate proxy to new IPv6
   */
  async rotateProxy(
    id: number,
    newIPv6: string,
    interfaceName: string,
    prefix: number,
    graceful: boolean = false,
    drainTimeout: number = 30000
  ): Promise<void> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      throw new Error(`Proxy ${id} not found`);
    }

    const oldIPv6 = proxy.ipv6;

    if (graceful) {
      // Graceful rotation: start new, drain old, stop old
      
      // Add new IPv6
      await ipv6Service.addIPv6ToInterface(interfaceName, newIPv6, prefix);

      // Create temporary proxy with new IP
      const tempProxy: ProxyInstance = {
        ...proxy,
        ipv6: newIPv6,
      };

      // Generate new config
      const newConfigPath = await this.generateProxyConfig(tempProxy);

      // Start new process
      const newProcess = spawn(this.proxyBinaryPath, [newConfigPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Mark old as draining
      proxy.status = 'draining';

      // Wait for drain
      await new Promise(resolve => setTimeout(resolve, drainTimeout));

      // Stop old process
      if (proxy.process && proxy.pid) {
        try {
          proxy.process.kill('SIGTERM');
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (!proxy.process.killed) {
            proxy.process.kill('SIGKILL');
          }
        } catch (error) {
          console.error(`Error killing old proxy ${id}:`, error);
        }
      }

      // Clean up old config
      if (proxy.configPath) {
        try {
          await unlinkAsync(proxy.configPath);
        } catch (error) {
          console.warn(`Failed to delete old config:`, error);
        }
      }

      // Update proxy with new details
      proxy.ipv6 = newIPv6;
      proxy.process = newProcess;
      proxy.pid = newProcess.pid;
      proxy.configPath = newConfigPath;
      proxy.status = 'running';
      proxy.lastRotated = new Date();

      // Remove old IPv6 (after a delay for safety)
      setTimeout(async () => {
        try {
          await ipv6Service.removeIPv6FromInterface(interfaceName, oldIPv6, prefix);
        } catch (error) {
          console.warn(`Failed to remove old IPv6:`, error);
        }
      }, 5000);

    } else {
      // Simple rotation: stop, change IP, start
      await this.stopProxy(id, false);

      // Remove old IPv6
      await ipv6Service.removeIPv6FromInterface(interfaceName, oldIPv6, prefix);

      // Add new IPv6
      await ipv6Service.addIPv6ToInterface(interfaceName, newIPv6, prefix);

      // Update proxy
      proxy.ipv6 = newIPv6;
      proxy.lastRotated = new Date();

      // Generate new config
      const configPath = await this.generateProxyConfig(proxy);
      proxy.configPath = configPath;

      // Start new process
      const process = spawn(this.proxyBinaryPath, [configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      proxy.process = process;
      proxy.pid = process.pid;
      proxy.status = 'running';

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Health check with retry
    await this.healthCheckWithRetry(id, 3, 2000);
  }

  /**
   * Rotate multiple proxies efficiently with a single authentication prompt
   * This batches all IPv6 address additions and removals into sudo commands
   */
  async rotateMultipleProxies(
    rotations: Array<{
      id: number;
      newIPv6: string;
    }>,
    interfaceName: string,
    prefix: number,
    graceful: boolean = false,
    drainTimeout: number = 30000
  ): Promise<void> {
    if (rotations.length === 0) {
      return;
    }

    console.log(`Batch rotating ${rotations.length} proxies...`);

    // Validate all proxies exist and collect old IPs
    const oldIPv6Addresses: Array<{ ipv6: string; prefix: number }> = [];
    const newIPv6Addresses: Array<{ ipv6: string; prefix: number }> = [];
    
    for (const rotation of rotations) {
      const proxy = this.proxies.get(rotation.id);
      if (!proxy) {
        throw new Error(`Proxy ${rotation.id} not found`);
      }
      oldIPv6Addresses.push({ ipv6: proxy.ipv6, prefix });
      newIPv6Addresses.push({ ipv6: rotation.newIPv6, prefix });
    }

    if (graceful) {
      // Graceful rotation: add new IPs, start new processes, drain, stop old, remove old IPs
      
      // Step 1: Batch add all new IPv6 addresses with single auth prompt
      await ipv6Service.addMultipleIPv6ToInterface(interfaceName, newIPv6Addresses);

      // Step 2: Start new processes for each proxy
      const newProcesses: Map<number, { process: ChildProcess; configPath: string }> = new Map();
      
      for (const rotation of rotations) {
        const proxy = this.proxies.get(rotation.id)!;
        
        // Create temporary proxy with new IP
        const tempProxy: ProxyInstance = {
          ...proxy,
          ipv6: rotation.newIPv6,
        };

        // Generate new config
        const newConfigPath = await this.generateProxyConfig(tempProxy);

        // Start new process
        const newProcess = spawn(this.proxyBinaryPath, [newConfigPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        });

        newProcesses.set(rotation.id, { process: newProcess, configPath: newConfigPath });

        // Mark old as draining
        proxy.status = 'draining';
      }

      // Step 3: Wait for drain timeout
      console.log(`Draining old proxies for ${drainTimeout}ms...`);
      await new Promise(resolve => setTimeout(resolve, drainTimeout));

      // Step 4: Stop all old processes
      for (const rotation of rotations) {
        const proxy = this.proxies.get(rotation.id)!;
        
        if (proxy.process && proxy.pid) {
          try {
            proxy.process.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!proxy.process.killed) {
              proxy.process.kill('SIGKILL');
            }
          } catch (error) {
            console.error(`Error killing old proxy ${rotation.id}:`, error);
          }
        }

        // Clean up old config
        if (proxy.configPath) {
          try {
            await unlinkAsync(proxy.configPath);
          } catch (error) {
            console.warn(`Failed to delete old config:`, error);
          }
        }
      }

      // Step 5: Update all proxies with new details
      for (const rotation of rotations) {
        const proxy = this.proxies.get(rotation.id)!;
        const newProcessData = newProcesses.get(rotation.id)!;

        proxy.ipv6 = rotation.newIPv6;
        proxy.process = newProcessData.process;
        proxy.pid = newProcessData.process.pid;
        proxy.configPath = newProcessData.configPath;
        proxy.status = 'running';
        proxy.lastRotated = new Date();

        // Setup event handlers for new process
        newProcessData.process.on('error', (error) => {
          console.error(`Proxy ${rotation.id} error:`, error);
          proxy.status = 'error';
        });

        newProcessData.process.on('exit', (code) => {
          console.log(`Proxy ${rotation.id} exited with code ${code}`);
          if (proxy.status !== 'draining') {
            proxy.status = 'stopped';
          }
        });

        newProcessData.process.stdout?.on('data', (data) => {
          console.log(`Proxy ${rotation.id} stdout:`, data.toString());
        });

        newProcessData.process.stderr?.on('data', (data) => {
          console.error(`Proxy ${rotation.id} stderr:`, data.toString());
        });
      }

      // Step 6: Batch remove old IPv6 addresses after a delay for safety
      setTimeout(async () => {
        try {
          await ipv6Service.removeMultipleIPv6FromInterface(interfaceName, oldIPv6Addresses);
          console.log('Old IPv6 addresses removed successfully');
        } catch (error) {
          console.warn(`Failed to remove old IPv6 addresses:`, error);
        }
      }, 5000);

    } else {
      // Simple rotation: stop all, swap IPs in batch, start all
      
      // Step 1: Stop all proxies
      const stopPromises = rotations.map(rotation => this.stopProxy(rotation.id, false));
      await Promise.all(stopPromises);

      // Step 2: Batch remove old IPv6 and add new IPv6 with single auth prompt
      // Remove old IPs first
      await ipv6Service.removeMultipleIPv6FromInterface(interfaceName, oldIPv6Addresses);
      
      // Add new IPs
      await ipv6Service.addMultipleIPv6ToInterface(interfaceName, newIPv6Addresses);

      // Step 3: Update proxies and start new processes
      for (const rotation of rotations) {
        const proxy = this.proxies.get(rotation.id)!;

        // Update proxy
        proxy.ipv6 = rotation.newIPv6;
        proxy.lastRotated = new Date();

        // Generate new config
        const configPath = await this.generateProxyConfig(proxy);
        proxy.configPath = configPath;

        // Start new process
        const process = spawn(this.proxyBinaryPath, [configPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        });

        proxy.process = process;
        proxy.pid = process.pid;
        proxy.status = 'running';

        // Setup event handlers
        process.on('error', (error) => {
          console.error(`Proxy ${rotation.id} error:`, error);
          proxy.status = 'error';
        });

        process.on('exit', (code) => {
          console.log(`Proxy ${rotation.id} exited with code ${code}`);
          if (proxy.status !== 'draining') {
            proxy.status = 'stopped';
          }
        });

        process.stdout?.on('data', (data) => {
          console.log(`Proxy ${rotation.id} stdout:`, data.toString());
        });

        process.stderr?.on('data', (data) => {
          console.error(`Proxy ${rotation.id} stderr:`, data.toString());
        });
      }

      // Step 4: Wait for all proxies to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Health check all rotated proxies in parallel
    await Promise.allSettled(
      rotations.map(rotation => this.healthCheckWithRetry(rotation.id, 3, 2000))
    );

    console.log(`Batch rotation of ${rotations.length} proxies completed`);
  }

  /**
   * Health check for proxy with retry mechanism
   */
  async healthCheckWithRetry(
    id: number, 
    maxRetries: number = 3, 
    initialDelay: number = 2000
  ): Promise<boolean> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return false;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Health check attempt ${attempt}/${maxRetries} for proxy ${id}`);
        
        const isHealthy = await this.healthCheck(id);
        
        if (isHealthy) {
          console.log(`Proxy ${id} is healthy after ${attempt} attempt(s)`);
          return true;
        }
        
        // If not healthy but no error thrown, wait before retry
        if (attempt < maxRetries) {
          const delay = initialDelay * attempt; // Linear backoff
          console.log(`Proxy ${id} unhealthy, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`Health check attempt ${attempt}/${maxRetries} failed for proxy ${id}:`, error);
        
        if (attempt < maxRetries) {
          const delay = initialDelay * attempt; // Linear backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`Proxy ${id} failed health check after ${maxRetries} attempts`);
    if (proxy) {
      proxy.healthCheckStatus = 'unhealthy';
    }
    
    return false;
  }

  /**
   * Health check for proxy
   */
  async healthCheck(id: number): Promise<boolean> {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return false;
    }

    proxy.healthCheckStatus = 'checking';

    try {
      // Use curl to test proxy
      const proxyUrl = proxy.type === 'HTTP' 
        ? `http://127.0.0.1:${proxy.port}`
        : `socks5://127.0.0.1:${proxy.port}`;

      let curlCmd = `curl -6 --proxy ${proxyUrl} --max-time 10 https://api64.ipify.org`;
      
      if (proxy.username && proxy.password) {
        curlCmd = `curl -6 --proxy ${proxyUrl} --proxy-user ${proxy.username}:${proxy.password} --max-time 10 https://api64.ipify.org`;
      }

      const { stdout } = await execAsync(curlCmd);
      const returnedIP = stdout.trim();

      // Check if returned IP matches our IPv6
      const isHealthy = returnedIP === proxy.ipv6;
      proxy.healthCheckStatus = isHealthy ? 'healthy' : 'unhealthy';

      return isHealthy;
    } catch (error) {
      console.error(`Health check failed for proxy ${id}:`, error);
      proxy.healthCheckStatus = 'unhealthy';
      return false;
    }
  }

  /**
   * Get proxy instance
   */
  getProxy(id: number): ProxyInstance | undefined {
    return this.proxies.get(id);
  }

  /**
   * Get all proxies
   */
  getAllProxies(): ProxyInstance[] {
    return Array.from(this.proxies.values());
  }

  /**
   * Start multiple proxies efficiently with a single authentication prompt
   * This batches all IPv6 address additions into one sudo command
   */
  async startMultipleProxies(
    configs: Array<{
      id: number;
      type: 'HTTP' | 'SOCKS5';
      port: number;
      ipv6: string;
      interfaceName: string;
      prefix: number;
      username?: string;
      password?: string;
    }>
  ): Promise<ProxyInstance[]> {
    if (configs.length === 0) {
      return [];
    }

    // Step 1: Batch add all IPv6 addresses with a single authentication prompt
    const ipv6ToAdd = configs.map(config => ({
      ipv6: config.ipv6,
      prefix: config.prefix,
    }));

    const interfaceName = configs[0].interfaceName; // Assume all use same interface
    await ipv6Service.addMultipleIPv6ToInterface(interfaceName, ipv6ToAdd);

    // Detect LAN IPv4 address (same for all proxies)
    const lanIp = ipv6Service.detectLanIPv4();

    // Step 2: Start each proxy (without needing sudo anymore)
    const results: ProxyInstance[] = [];
    const errors: Array<{ id: number; error: Error }> = [];

    for (const config of configs) {
      try {
        // Check if proxy already exists
        if (this.proxies.has(config.id)) {
          throw new Error(`Proxy ${config.id} already exists`);
        }

        // Create proxy instance
        const proxy: ProxyInstance = {
          id: config.id,
          type: config.type,
          port: config.port,
          ipv6: config.ipv6,
          lanIp,
          username: config.username,
          password: config.password,
          status: 'stopped',
          lastRotated: new Date(),
        };

        // Generate config
        const configPath = await this.generateProxyConfig(proxy);
        proxy.configPath = configPath;

        // Start 3proxy process
        const process = spawn(this.proxyBinaryPath, [configPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        });

        proxy.process = process;
        proxy.pid = process.pid;
        proxy.status = 'running';

        // Handle process events
        process.on('error', (error) => {
          console.error(`Proxy ${config.id} error:`, error);
          proxy.status = 'error';
        });

        process.on('exit', (code) => {
          console.log(`Proxy ${config.id} exited with code ${code}`);
          if (proxy.status !== 'draining') {
            proxy.status = 'stopped';
          }
        });

        // Log output
        process.stdout?.on('data', (data) => {
          console.log(`Proxy ${config.id} stdout:`, data.toString());
        });

        process.stderr?.on('data', (data) => {
          console.error(`Proxy ${config.id} stderr:`, data.toString());
        });

        this.proxies.set(config.id, proxy);
        results.push(proxy);

      } catch (error: any) {
        errors.push({ id: config.id, error });
        console.error(`Failed to start proxy ${config.id}:`, error);
      }
    }

    // Wait a bit for all proxies to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Health check all proxies in parallel with retry
    await Promise.allSettled(
      results.map(proxy => this.healthCheckWithRetry(proxy.id, 3, 2000))
    );

    // If there were errors, report them
    if (errors.length > 0) {
      const errorMsg = errors.map(e => `Proxy ${e.id}: ${e.error.message}`).join(', ');
      throw new Error(`Some proxies failed to start: ${errorMsg}`);
    }

    return results;
  }

  /**
   * Stop all proxies
   */
  async stopAllProxies(): Promise<void> {
    const stopPromises = Array.from(this.proxies.keys()).map(id => 
      this.stopProxy(id, false)
    );
    await Promise.all(stopPromises);
    this.proxies.clear();
  }

  /**
   * Get proxy URI for copying
   */
  getProxyURI(id: number): string {
    const proxy = this.proxies.get(id);
    if (!proxy) {
      return '';
    }

    const protocol = proxy.type === 'HTTP' ? 'http' : 'socks5';
    const auth = proxy.username && proxy.password 
      ? `${proxy.username}:${proxy.password}@`
      : '';
    
    return `${protocol}://${auth}127.0.0.1:${proxy.port}`;
  }

  /**
   * Convert ProxyInstance to serializable format for IPC
   * Removes non-serializable properties like ChildProcess
   */
  private toSerializable(proxy: ProxyInstance): Omit<ProxyInstance, 'process' | 'configPath'> {
    return {
      id: proxy.id,
      type: proxy.type,
      port: proxy.port,
      ipv6: proxy.ipv6,
      lanIp: proxy.lanIp,
      username: proxy.username,
      password: proxy.password,
      status: proxy.status,
      pid: proxy.pid,
      lastRotated: proxy.lastRotated,
      healthCheckStatus: proxy.healthCheckStatus,
    };
  }

  /**
   * Convert array of ProxyInstances to serializable format
   */
  toSerializableArray(proxies: ProxyInstance[]): Array<Omit<ProxyInstance, 'process' | 'configPath'>> {
    return proxies.map(proxy => this.toSerializable(proxy));
  }

  /**
   * Delete all proxies (stop + remove interfaces)
   */
  async deleteAllProxies(interfaceName: string, prefix: number): Promise<void> {
    // Get all IPv6 addresses before stopping
    const ipv6Addresses = Array.from(this.proxies.values()).map(p => ({ 
      ipv6: p.ipv6, 
      prefix 
    }));
    
    // Stop all proxies
    await this.stopAllProxies();
    
    // Remove all IPv6 addresses from interface with a single authentication prompt
    if (ipv6Addresses.length > 0) {
      try {
        await ipv6Service.removeMultipleIPv6FromInterface(interfaceName, ipv6Addresses);
      } catch (error) {
        console.warn(`Failed to remove IPv6 addresses:`, error);
      }
    }
  }
}

export const proxyService = new ProxyService();