import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { sudoService } from './sudoService';

const execAsync = promisify(exec);

export interface NetworkInterface {
  name: string;
  ipv6: string;
  prefix: number;
  prefixBase: string;
}

export class IPv6Service {
  /**
   * Detect all network interfaces with IPv6 addresses
   */
  async detectInterfaces(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    const networkInterfaces = os.networkInterfaces();

    for (const [name, addrs] of Object.entries(networkInterfaces)) {
      if (!addrs) continue;

      for (const addr of addrs) {
        if (addr.family === 'IPv6' && !addr.internal && addr.scopeid === 0) {
          // Only global IPv6 addresses
          const prefix = this.getPrefixLength(addr.netmask);
          const prefixBase = this.calculatePrefixBase(addr.address, prefix);
          
          interfaces.push({
            name,
            ipv6: addr.address,
            prefix,
            prefixBase: `${prefixBase}/${prefix}`
          });
        }
      }
    }

    return interfaces;
  }

  /**
   * Calculate prefix length from netmask
   */
  private getPrefixLength(netmask: string): number {
    // Convert netmask to binary and count 1s
    const parts = netmask.split(':');
    let ones = 0;
    
    for (const part of parts) {
      if (!part) continue;
      const num = parseInt(part, 16);
      ones += num.toString(2).split('1').length - 1;
    }
    
    return ones;
  }

  /**
   * Calculate prefix base from IPv6 address and prefix length
   */
  private calculatePrefixBase(ipv6: string, prefix: number): string {
    // Expand IPv6 to full form
    const expanded = this.expandIPv6(ipv6);
    const parts = expanded.split(':');
    
    // Calculate how many parts to keep based on prefix
    const bitsToKeep = prefix;
    const partsToKeep = Math.floor(bitsToKeep / 16);
    const remainingBits = bitsToKeep % 16;
    
    const baseParts = parts.slice(0, partsToKeep);
    
    if (remainingBits > 0 && partsToKeep < 8) {
      const mask = (0xFFFF << (16 - remainingBits)) & 0xFFFF;
      const maskedPart = (parseInt(parts[partsToKeep], 16) & mask).toString(16).padStart(4, '0');
      baseParts.push(maskedPart);
    }
    
    // Fill remaining with zeros
    while (baseParts.length < 8) {
      baseParts.push('0000');
    }
    
    return this.compressIPv6(baseParts.join(':'));
  }

  /**
   * Expand IPv6 address to full form
   */
  private expandIPv6(ipv6: string): string {
    if (ipv6.includes('::')) {
      const parts = ipv6.split('::');
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - left.length - right.length;
      const middle = Array(missing).fill('0000');
      const all = [...left, ...middle, ...right];
      return all.map(p => p.padStart(4, '0')).join(':');
    }
    return ipv6.split(':').map(p => p.padStart(4, '0')).join(':');
  }

  /**
   * Compress IPv6 address
   */
  private compressIPv6(ipv6: string): string {
    // Remove leading zeros
    let compressed = ipv6.replace(/(^|:)0+([0-9a-f])/g, '$1$2');
    
    // Replace longest sequence of :0:0: with ::
    const zeroSequences = compressed.match(/(^|:)(0:)+/g);
    if (zeroSequences) {
      const longest = zeroSequences.reduce((a, b) => a.length > b.length ? a : b);
      compressed = compressed.replace(longest, '::');
    }
    
    return compressed;
  }

  /**
   * Generate random IPv6 address within prefix
   */
  generateRandomIPv6(prefixBase: string, prefix: number): string {
    const base = prefixBase.replace(`/${prefix}`, '');
    const expanded = this.expandIPv6(base);
    const parts = expanded.split(':');
    
    // Calculate which parts to randomize
    const fixedParts = Math.floor(prefix / 16);
    
    // Randomize the remaining parts
    for (let i = fixedParts; i < 8; i++) {
      parts[i] = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    }
    
    return this.compressIPv6(parts.join(':'));
  }

  /**
   * Add IPv6 address to interface (requires sudo)
   */
  async addIPv6ToInterface(interfaceName: string, ipv6: string, prefix: number): Promise<void> {
    const platform = os.platform();
    
    try {
      let command: string;
      
      if (platform === 'darwin') {
        // macOS - use sudo-prompt for native authentication dialog
        command = `ifconfig ${interfaceName} inet6 ${ipv6} prefixlen ${prefix} add`;
        await sudoService.exec(command);
      } else if (platform === 'linux') {
        // Linux - use sudo-prompt for authentication dialog
        command = `ip -6 addr add ${ipv6}/${prefix} dev ${interfaceName}`;
        await sudoService.exec(command);
      } else if (platform === 'win32') {
        // Windows - netsh requires admin but doesn't use sudo
        command = `netsh interface ipv6 add address "${interfaceName}" ${ipv6}`;
        await sudoService.exec(command);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error: any) {
      // Ignore if address already exists
      if (!error.message.includes('File exists') && !error.message.includes('already')) {
        throw error;
      }
    }
  }

  /**
   * Add multiple IPv6 addresses to interface with a single authentication prompt
   * This is much more efficient than calling addIPv6ToInterface multiple times
   */
  async addMultipleIPv6ToInterface(
    interfaceName: string, 
    ipv6Addresses: Array<{ ipv6: string; prefix: number }>
  ): Promise<void> {
    if (ipv6Addresses.length === 0) {
      return;
    }

    const platform = os.platform();
    const commands: string[] = [];
    
    for (const { ipv6, prefix } of ipv6Addresses) {
      let command: string;
      
      if (platform === 'darwin') {
        command = `ifconfig ${interfaceName} inet6 ${ipv6} prefixlen ${prefix} add`;
      } else if (platform === 'linux') {
        command = `ip -6 addr add ${ipv6}/${prefix} dev ${interfaceName}`;
      } else if (platform === 'win32') {
        command = `netsh interface ipv6 add address "${interfaceName}" ${ipv6}`;
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      // Add error handling for each command to ignore "already exists" errors
      if (platform === 'darwin' || platform === 'linux') {
        command = `${command} 2>&1 | grep -v "File exists" | grep -v "already" || true`;
      }
      
      commands.push(command);
    }
    
    try {
      await sudoService.execMultiple(commands);
    } catch (error: any) {
      // Ignore if addresses already exist
      if (!error.message.includes('File exists') && !error.message.includes('already')) {
        throw error;
      }
    }
  }

  /**
   * Remove IPv6 address from interface (requires sudo)
   */
  async removeIPv6FromInterface(interfaceName: string, ipv6: string, prefix: number): Promise<void> {
    const platform = os.platform();
    
    try {
      let command: string;
      
      if (platform === 'darwin') {
        // macOS - use sudo-prompt for native authentication dialog
        command = `ifconfig ${interfaceName} inet6 ${ipv6} prefixlen ${prefix} delete`;
        await sudoService.exec(command);
      } else if (platform === 'linux') {
        // Linux - use sudo-prompt for authentication dialog
        command = `ip -6 addr del ${ipv6}/${prefix} dev ${interfaceName}`;
        await sudoService.exec(command);
      } else if (platform === 'win32') {
        // Windows - netsh requires admin but doesn't use sudo
        command = `netsh interface ipv6 delete address "${interfaceName}" ${ipv6}`;
        await sudoService.exec(command);
      }
    } catch (error) {
      // Ignore errors when removing (address might not exist)
      console.warn(`Failed to remove IPv6 ${ipv6}:`, error);
    }
  }

  /**
   * Remove multiple IPv6 addresses from interface with a single authentication prompt
   */
  async removeMultipleIPv6FromInterface(
    interfaceName: string, 
    ipv6Addresses: Array<{ ipv6: string; prefix: number }>
  ): Promise<void> {
    if (ipv6Addresses.length === 0) {
      return;
    }

    const platform = os.platform();
    const commands: string[] = [];
    
    for (const { ipv6, prefix } of ipv6Addresses) {
      let command: string;
      
      if (platform === 'darwin') {
        command = `ifconfig ${interfaceName} inet6 ${ipv6} prefixlen ${prefix} delete`;
      } else if (platform === 'linux') {
        command = `ip -6 addr del ${ipv6}/${prefix} dev ${interfaceName}`;
      } else if (platform === 'win32') {
        command = `netsh interface ipv6 delete address "${interfaceName}" ${ipv6}`;
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      // Ignore errors for each command (address might not exist)
      if (platform === 'darwin' || platform === 'linux') {
        command = `${command} 2>&1 || true`;
      }
      
      commands.push(command);
    }
    
    try {
      await sudoService.execMultiple(commands);
    } catch (error) {
      // Ignore errors when removing (addresses might not exist)
      console.warn(`Failed to remove some IPv6 addresses:`, error);
    }
  }

  /**
   * Test IPv6 connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const platform = os.platform();
      const command = platform === 'win32' 
        ? 'ping -6 -n 1 google.com'
        : 'ping6 -c 1 google.com';
      
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if IPv6 address is reachable
   */
  async checkIPv6Reachable(ipv6: string): Promise<boolean> {
    try {
      const platform = os.platform();
      const command = platform === 'win32'
        ? `ping -6 -n 1 -S ${ipv6} google.com`
        : `ping6 -c 1 -I ${ipv6} google.com`;
      
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect LAN IPv4 address (private network address)
   * Returns the first non-internal IPv4 address found
   */
  detectLanIPv4(): string | undefined {
    const networkInterfaces = os.networkInterfaces();

    for (const addrs of Object.values(networkInterfaces)) {
      if (!addrs) continue;

      for (const addr of addrs) {
        // Look for IPv4 addresses that are not internal (not 127.0.0.1)
        // and are in private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (addr.family === 'IPv4' && !addr.internal) {
          const ip = addr.address;
          // Check if it's a private IP address
          if (
            ip.startsWith('192.168.') ||
            ip.startsWith('10.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
          ) {
            return ip;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Get all IPv6 addresses on a specific interface
   * Returns both system default and custom added addresses
   */
  async getAllIPv6OnInterface(interfaceName: string): Promise<Array<{ ipv6: string; prefix: number }>> {
    const platform = os.platform();
    const addresses: Array<{ ipv6: string; prefix: number }> = [];

    try {
      let command: string;
      let output: string;

      if (platform === 'darwin') {
        // macOS - use ifconfig to get all IPv6 addresses
        command = `ifconfig ${interfaceName}`;
        const result = await execAsync(command);
        output = result.stdout;

        // Parse ifconfig output for IPv6 addresses
        // Format: inet6 <address> prefixlen <prefix> ...
        const regex = /inet6\s+([0-9a-f:]+)\s+prefixlen\s+(\d+)/gi;
        let match;
        while ((match = regex.exec(output)) !== null) {
          const ipv6 = match[1];
          const prefix = parseInt(match[2], 10);
          // Skip link-local addresses (fe80::)
          if (!ipv6.startsWith('fe80:')) {
            addresses.push({ ipv6, prefix });
          }
        }
      } else if (platform === 'linux') {
        // Linux - use ip command
        command = `ip -6 addr show ${interfaceName}`;
        const result = await execAsync(command);
        output = result.stdout;

        // Parse ip output for IPv6 addresses
        // Format: inet6 <address>/<prefix> scope global ...
        const regex = /inet6\s+([0-9a-f:]+)\/(\d+)\s+scope\s+global/gi;
        let match;
        while ((match = regex.exec(output)) !== null) {
          const ipv6 = match[1];
          const prefix = parseInt(match[2], 10);
          addresses.push({ ipv6, prefix });
        }
      } else if (platform === 'win32') {
        // Windows - use netsh
        command = `netsh interface ipv6 show addresses "${interfaceName}"`;
        const result = await execAsync(command);
        output = result.stdout;

        // Parse netsh output for IPv6 addresses
        const lines = output.split('\n');
        for (const line of lines) {
          const match = line.match(/([0-9a-f:]+)/i);
          if (match && !match[1].startsWith('fe80:')) {
            // Windows doesn't easily show prefix, assume 64
            addresses.push({ ipv6: match[1], prefix: 64 });
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to get IPv6 addresses for ${interfaceName}:`, error);
    }

    return addresses;
  }

  /**
   * Reset IPv6 interfaces - remove all custom IPv6 addresses, keeping only system defaults
   * This will get all IPv6 addresses on the interface and remove them, except the original one
   */
  async resetIPv6Interfaces(interfaceName: string, originalIPv6: string): Promise<number> {
    try {
      // Get all IPv6 addresses on the interface
      const allAddresses = await this.getAllIPv6OnInterface(interfaceName);
      
      // Filter out the original system IPv6 address
      const customAddresses = allAddresses.filter(addr => addr.ipv6 !== originalIPv6);
      
      if (customAddresses.length === 0) {
        return 0;
      }

      // Remove all custom addresses
      await this.removeMultipleIPv6FromInterface(interfaceName, customAddresses);
      
      return customAddresses.length;
    } catch (error: any) {
      throw new Error(`Failed to reset IPv6 interfaces: ${error.message}`);
    }
  }
}

export const ipv6Service = new IPv6Service();