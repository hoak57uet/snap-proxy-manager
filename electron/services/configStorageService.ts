import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface ProxyConfigData {
  id: number;
  type: 'HTTP' | 'SOCKS5';
  port: number;
  ipv6: string;
  interfaceName: string;
  prefix: number;
  username?: string;
  password?: string;
}

export interface AppConfig {
  proxies: ProxyConfigData[];
  networkInterface?: {
    name: string;
    ipv6: string;
    prefix: number;
    prefixBase: string;
  };
}

export class ConfigStorageService {
  private configPath: string;

  constructor() {
    // Use app.getPath('userData') for persistent storage
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'proxy-config.json');
    this.ensureConfigFile();
  }

  private ensureConfigFile() {
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig({ proxies: [] });
    }
  }

  /**
   * Load configuration from file
   */
  loadConfig(): AppConfig {
    try {
      const data = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load config:', error);
      return { proxies: [] };
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(config: AppConfig): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Add proxy configs to storage
   */
  addProxyConfigs(configs: ProxyConfigData[]): void {
    const currentConfig = this.loadConfig();
    
    // Find the highest existing ID
    const maxId = currentConfig.proxies.reduce((max, p) => Math.max(max, p.id), -1);
    
    // Reassign IDs to new configs to avoid conflicts
    const newConfigs = configs.map((config, index) => ({
      ...config,
      id: maxId + 1 + index,
    }));
    
    currentConfig.proxies.push(...newConfigs);
    this.saveConfig(currentConfig);
  }

  /**
   * Get all proxy configs
   */
  getAllProxyConfigs(): ProxyConfigData[] {
    const config = this.loadConfig();
    return config.proxies;
  }

  /**
   * Delete all proxy configs
   */
  deleteAllProxyConfigs(): void {
    const config = this.loadConfig();
    config.proxies = [];
    this.saveConfig(config);
  }

  /**
   * Delete a single proxy config
   */
  deleteProxyConfig(id: number): void {
    const config = this.loadConfig();
    config.proxies = config.proxies.filter(p => p.id !== id);
    this.saveConfig(config);
  }

  /**
   * Save network interface config
   */
  saveNetworkInterface(iface: {
    name: string;
    ipv6: string;
    prefix: number;
    prefixBase: string;
  }): void {
    const config = this.loadConfig();
    config.networkInterface = iface;
    this.saveConfig(config);
  }

  /**
   * Get saved network interface
   */
  getNetworkInterface(): AppConfig['networkInterface'] {
    const config = this.loadConfig();
    return config.networkInterface;
  }
}

export const configStorageService = new ConfigStorageService();