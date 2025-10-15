import { proxyService } from './proxyService';
import { ipv6Service } from './ipv6Service';
import { sudoService } from './sudoService';

export interface RotationConfig {
  mode: 'manual' | 'interval';
  intervalSeconds?: number;
  staggerEnabled: boolean;
  staggerSeconds?: number;
  gracefulEnabled: boolean;
  drainTimeout?: number;
}

export class RotationService {
  private intervalTimer?: NodeJS.Timeout;
  private config: RotationConfig = {
    mode: 'manual',
    staggerEnabled: false,
    gracefulEnabled: false,
  };
  private interfaceName: string = '';
  private prefix: number = 64;
  private prefixBase: string = '';
  private onRotationCallback?: (proxyId: number, newIPv6: string) => void;

  /**
   * Set rotation configuration
   */
  async setConfig(config: RotationConfig) {
    this.config = config;
    
    // If enabling interval mode, request sudo access upfront
    if (config.mode === 'interval' && config.intervalSeconds) {
      // Request sudo access now so user authenticates once
      // This will cache the credentials for subsequent rotations
      await sudoService.exec('echo "Authenticating for scheduled rotation..."');
      this.startIntervalRotation();
    } else {
      this.stopIntervalRotation();
    }
  }

  /**
   * Set network configuration
   */
  setNetworkConfig(interfaceName: string, prefix: number, prefixBase: string) {
    this.interfaceName = interfaceName;
    this.prefix = prefix;
    this.prefixBase = prefixBase;
  }

  /**
   * Set callback for rotation events
   */
  onRotation(callback: (proxyId: number, newIPv6: string) => void) {
    this.onRotationCallback = callback;
  }

  /**
   * Start interval-based rotation
   */
  private startIntervalRotation() {
    this.stopIntervalRotation();

    if (!this.config.intervalSeconds) {
      return;
    }

    const intervalMs = this.config.intervalSeconds * 1000;

    this.intervalTimer = setInterval(async () => {
      await this.rotateAllProxies();
    }, intervalMs);

    console.log(`Started interval rotation every ${this.config.intervalSeconds} seconds`);
  }

  /**
   * Stop interval-based rotation
   */
  private stopIntervalRotation() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
      console.log('Stopped interval rotation');
    }
  }

  /**
   * Rotate all proxies
   */
  async rotateAllProxies(): Promise<void> {
    const proxies = proxyService.getAllProxies();
    
    if (proxies.length === 0) {
      console.log('No proxies to rotate');
      return;
    }

    console.log(`Rotating ${proxies.length} proxies...`);

    if (this.config.staggerEnabled && this.config.staggerSeconds) {
      // Staggered rotation - rotate one by one with delays
      for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        await this.rotateSingleProxy(proxy.id);
        
        // Wait for stagger delay (except for last proxy)
        if (i < proxies.length - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.staggerSeconds! * 1000)
          );
        }
      }
    } else {
      // Batch rotation - rotate all at once with single authentication prompt
      const rotations = proxies.map(proxy => ({
        id: proxy.id,
        newIPv6: this.generateUniqueIPv6()
      }));

      try {
        await proxyService.rotateMultipleProxies(
          rotations,
          this.interfaceName,
          this.prefix,
          this.config.gracefulEnabled,
          this.config.drainTimeout || 30000
        );

        // Notify callbacks for all rotations
        if (this.onRotationCallback) {
          for (const rotation of rotations) {
            this.onRotationCallback(rotation.id, rotation.newIPv6);
          }
        }
      } catch (error) {
        console.error('Batch rotation failed:', error);
        throw error;
      }
    }

    console.log('Rotation completed');
  }

  /**
   * Rotate a single proxy
   */
  async rotateSingleProxy(proxyId: number): Promise<void> {
    try {
      // Generate new IPv6
      const newIPv6 = this.generateUniqueIPv6();

      console.log(`Rotating proxy ${proxyId} to ${newIPv6}`);

      // Rotate
      await proxyService.rotateProxy(
        proxyId,
        newIPv6,
        this.interfaceName,
        this.prefix,
        this.config.gracefulEnabled,
        this.config.drainTimeout || 30000
      );

      // Notify callback
      if (this.onRotationCallback) {
        this.onRotationCallback(proxyId, newIPv6);
      }

      console.log(`Proxy ${proxyId} rotated successfully`);
    } catch (error) {
      console.error(`Failed to rotate proxy ${proxyId}:`, error);
      throw error;
    }
  }

  /**
   * Generate unique IPv6 address (not used by other proxies)
   */
  private generateUniqueIPv6(): string {
    const existingIPs = new Set(
      proxyService.getAllProxies().map(p => p.ipv6)
    );

    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const newIP = ipv6Service.generateRandomIPv6(this.prefixBase, this.prefix);
      
      if (!existingIPs.has(newIP)) {
        return newIP;
      }
      
      attempts++;
    }

    throw new Error('Failed to generate unique IPv6 address after 100 attempts');
  }

  /**
   * Manually trigger rotation now
   */
  async rotateNow(): Promise<void> {
    await this.rotateAllProxies();
  }

  /**
   * Clean up
   */
  destroy() {
    this.stopIntervalRotation();
  }
}

export const rotationService = new RotationService();