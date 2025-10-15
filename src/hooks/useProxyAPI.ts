// Hook to interact with Electron IPC
import { useCallback } from 'react';

export interface NetworkInterface {
  name: string;
  ipv6: string;
  prefix: number;
  prefixBase: string;
}

export interface ProxyConfig {
  id: number;
  type: 'HTTP' | 'SOCKS5';
  port: number;
  ipv6: string;
  lanIp?: string;
  username?: string;
  password?: string;
  status: 'running' | 'stopped' | 'error' | 'draining';
  pid?: number;
  lastRotated?: Date;
  healthCheckStatus?: 'healthy' | 'unhealthy' | 'checking';
}

export interface RotationConfig {
  mode: 'manual' | 'interval';
  intervalSeconds?: number;
  staggerEnabled: boolean;
  staggerSeconds?: number;
  gracefulEnabled: boolean;
  drainTimeout?: number;
}

export const useProxyAPI = () => {
  // IPv6 APIs
  const detectIPv6 = useCallback(async (): Promise<NetworkInterface[]> => {
    const result = await window.ipcRenderer.invoke('ipv6:detect');
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const testConnectivity = useCallback(async (): Promise<boolean> => {
    const result = await window.ipcRenderer.invoke('ipv6:test-connectivity');
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const generateIPv6Addresses = useCallback(
    async (prefixBase: string, prefix: number, count: number): Promise<string[]> => {
      const result = await window.ipcRenderer.invoke('ipv6:generate', prefixBase, prefix, count);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    },
    []
  );

  // Proxy APIs
  const startProxy = useCallback(
    async (config: {
      id: number;
      type: 'HTTP' | 'SOCKS5';
      port: number;
      ipv6: string;
      interfaceName: string;
      prefix: number;
      username?: string;
      password?: string;
    }): Promise<ProxyConfig> => {
      const result = await window.ipcRenderer.invoke('proxy:start', config);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    },
    []
  );

  const startMultipleProxies = useCallback(
    async (configs: Array<{
      id: number;
      type: 'HTTP' | 'SOCKS5';
      port: number;
      ipv6: string;
      interfaceName: string;
      prefix: number;
      username?: string;
      password?: string;
    }>): Promise<ProxyConfig[]> => {
      const result = await window.ipcRenderer.invoke('proxy:start-multiple', configs);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    },
    []
  );

  const stopProxy = useCallback(async (id: number): Promise<void> => {
    const result = await window.ipcRenderer.invoke('proxy:stop', id);
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const stopAllProxies = useCallback(async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke('proxy:stop-all');
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const getAllProxies = useCallback(async (): Promise<ProxyConfig[]> => {
    const result = await window.ipcRenderer.invoke('proxy:get-all');
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const healthCheckProxy = useCallback(async (id: number): Promise<boolean> => {
    const result = await window.ipcRenderer.invoke('proxy:health-check', id);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const getProxyURI = useCallback(async (id: number): Promise<string> => {
    const result = await window.ipcRenderer.invoke('proxy:get-uri', id);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const rotateProxy = useCallback(
    async (
      id: number,
      newIPv6: string,
      interfaceName: string,
      prefix: number,
      graceful: boolean
    ): Promise<void> => {
      const result = await window.ipcRenderer.invoke(
        'proxy:rotate',
        id,
        newIPv6,
        interfaceName,
        prefix,
        graceful
      );
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    []
  );

  // Rotation APIs
  const setRotationConfig = useCallback(async (config: RotationConfig): Promise<void> => {
    const result = await window.ipcRenderer.invoke('rotation:set-config', config);
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const setNetworkConfig = useCallback(
    async (interfaceName: string, prefix: number, prefixBase: string): Promise<void> => {
      const result = await window.ipcRenderer.invoke(
        'rotation:set-network',
        interfaceName,
        prefix,
        prefixBase
      );
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    []
  );

  const rotateNow = useCallback(async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke('rotation:rotate-now');
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  // Event listeners
  const onRotationCompleted = useCallback(
    (callback: (data: { proxyId: number; newIPv6: string }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      window.ipcRenderer.on('rotation:completed', listener);
      return () => window.ipcRenderer.off('rotation:completed', listener);
    },
    []
  );

  // Config Storage APIs
  const addProxyConfigs = useCallback(
    async (configs: Array<{
      id: number;
      type: 'HTTP' | 'SOCKS5';
      port: number;
      ipv6: string;
      interfaceName: string;
      prefix: number;
      username?: string;
      password?: string;
    }>): Promise<void> => {
      const result = await window.ipcRenderer.invoke('config:add-proxies', configs);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    []
  );

  const getAllProxyConfigs = useCallback(async (): Promise<Array<{
    id: number;
    type: 'HTTP' | 'SOCKS5';
    port: number;
    ipv6: string;
    interfaceName: string;
    prefix: number;
    username?: string;
    password?: string;
  }>> => {
    const result = await window.ipcRenderer.invoke('config:get-all');
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const deleteAllProxyConfigs = useCallback(async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke('config:delete-all');
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const deleteProxyConfig = useCallback(async (id: number): Promise<void> => {
    const result = await window.ipcRenderer.invoke('config:delete', id);
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const saveNetworkConfig = useCallback(
    async (iface: {
      name: string;
      ipv6: string;
      prefix: number;
      prefixBase: string;
    }): Promise<void> => {
      const result = await window.ipcRenderer.invoke('config:save-network', iface);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    []
  );

  const getNetworkConfig = useCallback(async (): Promise<{
    name: string;
    ipv6: string;
    prefix: number;
    prefixBase: string;
  } | undefined> => {
    const result = await window.ipcRenderer.invoke('config:get-network');
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error);
  }, []);

  const deleteAllProxies = useCallback(async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke('proxy:delete-all');
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const saveNetworkInterface = useCallback(async (interfaceName: string): Promise<void> => {
    const result = await window.ipcRenderer.invoke('config:save-network', { name: interfaceName });
    if (!result.success) {
      throw new Error(result.error);
    }
  }, []);

  const getSavedNetworkInterface = useCallback(async (): Promise<string | undefined> => {
    const result = await window.ipcRenderer.invoke('config:get-network');
    if (result.success && result.data) {
      return result.data.name;
    }
    return undefined;
  }, []);

  const resetIPv6Interfaces = useCallback(
    async (interfaceName: string, originalIPv6: string): Promise<number> => {
      const result = await window.ipcRenderer.invoke('ipv6:reset-interfaces', interfaceName, originalIPv6);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error);
    },
    []
  );

  return {
    // IPv6
    detectIPv6,
    testConnectivity,
    generateIPv6Addresses,
    resetIPv6Interfaces,
    // Proxy
    startProxy,
    startMultipleProxies,
    stopProxy,
    stopAllProxies,
    getAllProxies,
    healthCheckProxy,
    getProxyURI,
    rotateProxy,
    deleteAllProxies,
    // Rotation
    setRotationConfig,
    setNetworkConfig,
    rotateNow,
    onRotationCompleted,
    // Config Storage
    addProxyConfigs,
    getAllProxyConfigs,
    deleteAllProxyConfigs,
    deleteProxyConfig,
    saveNetworkConfig,
    getNetworkConfig,
    saveNetworkInterface,
    getSavedNetworkInterface,
  };
};