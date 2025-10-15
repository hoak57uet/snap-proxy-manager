import { useState, useEffect } from 'react';
import { ConfigProvider, Layout, theme, message, Row, Col, Modal } from 'antd';
import { ProxyConfiguration } from './components/ProxyConfiguration';
import { ProxyList } from './components/ProxyList';
import { RotationControl } from './components/RotationControl';
import { LogsConsole } from './components/LogsConsole';
import { AppHeader } from './components/AppHeader';
import { useProxyAPI, NetworkInterface, ProxyConfig, RotationConfig } from './hooks/useProxyAPI';
import './App.css';

const { Content } = Layout;

type ThemeMode = 'dark' | 'light';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'rotation';
  proxyId?: number;
  message: string;
}

function App() {
  const [ipv6Status, setIPv6Status] = useState<{
    connected: boolean;
    interfaces: NetworkInterface[];
    selectedInterface?: NetworkInterface;
  }>({
    connected: false,
    interfaces: [],
  });

  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [proxyConfigs, setProxyConfigs] = useState<any[]>([]);
  const [rotationConfig, setRotationConfigState] = useState<RotationConfig>({
    mode: 'manual',
    staggerEnabled: false,
    gracefulEnabled: false,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsCollapsed, setLogsCollapsed] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    // Load theme from localStorage, default to dark
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
  });

  const api = useProxyAPI();

  // Toggle theme and save to localStorage
  const toggleTheme = () => {
    setThemeMode((prev) => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  };

  // Add log entry
  const addLog = (level: LogEntry['level'], message: string, proxyId?: number) => {
    const log: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      proxyId,
      message,
    };
    setLogs((prev) => [log, ...prev].slice(0, 1000)); // Keep last 1000 logs
  };

  // Scan network for IPv6
  const scanNetwork = async (): Promise<NetworkInterface[] | undefined> => {
    setLoading(true);
    try {
      const interfaces = await api.detectIPv6();
      const connected = interfaces.length > 0 && interfaces.some((i) => i.prefix <= 64);
      
      setIPv6Status({
        connected,
        interfaces,
        selectedInterface: interfaces[0],
      });

      if (connected) {
        addLog('info', `Detected ${interfaces.length} IPv6 interface(s)`);
      } else {
        addLog('warning', 'No IPv6 /64 prefix detected');
      }
      
      return interfaces;
    } catch (error: any) {
      message.error(`Failed to detect IPv6: ${error.message}`);
      addLog('error', `IPv6 detection failed: ${error.message}`);
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  // Test connectivity
  const testConnectivity = async () => {
    setLoading(true);
    try {
      const result = await api.testConnectivity();
      if (result) {
        message.success('IPv6 connectivity OK');
        addLog('info', 'IPv6 connectivity test passed');
      } else {
        message.warning('IPv6 connectivity failed');
        addLog('warning', 'IPv6 connectivity test failed');
      }
    } catch (error: any) {
      message.error(`Connectivity test failed: ${error.message}`);
      addLog('error', `Connectivity test error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset IPv6 interfaces
  const resetIPv6Interfaces = async () => {
    if (!ipv6Status.selectedInterface) {
      message.error('No interface selected');
      return;
    }

    const { selectedInterface } = ipv6Status;

    Modal.confirm({
      title: 'Reset IPv6 Interfaces',
      content: `Are you sure you want to remove all custom IPv6 addresses from interface "${selectedInterface.name}"? Only the original system IPv6 address will be preserved.`,
      okText: 'Yes, Reset',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setLoading(true);
        try {
          const removedCount = await api.resetIPv6Interfaces(
            selectedInterface.name,
            selectedInterface.ipv6
          );
          
          if (removedCount > 0) {
            message.success(`Removed ${removedCount} custom IPv6 address(es)`);
            addLog('info', `Reset IPv6 interfaces: removed ${removedCount} custom address(es) from ${selectedInterface.name}`);
          } else {
            message.info('No custom IPv6 addresses found to remove');
            addLog('info', `No custom IPv6 addresses found on ${selectedInterface.name}`);
          }
        } catch (error: any) {
          message.error(`Failed to reset interfaces: ${error.message}`);
          addLog('error', `IPv6 reset failed: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Refresh proxies list
  const refreshProxies = async () => {
    try {
      const allProxies = await api.getAllProxies();
      setProxies(allProxies);
    } catch (error: any) {
      console.error('Failed to refresh proxies:', error);
    }
  };

  // Refresh proxy configs
  const refreshProxyConfigs = async () => {
    try {
      const configs = await api.getAllProxyConfigs();
      setProxyConfigs(configs);
    } catch (error: any) {
      console.error('Failed to refresh proxy configs:', error);
    }
  };

  // Add proxies (save config only, don't start)
  const addProxies = async (plan: {
    type: 'HTTP' | 'SOCKS5';
    numberOfProxies: number;
    portStart: number;
    username?: string;
    password?: string;
    ipv6List: string[];
  }) => {
    if (!ipv6Status.selectedInterface) {
      message.error('No interface selected');
      return;
    }

    setLoading(true);
    addLog('info', `Adding ${plan.numberOfProxies} proxy configs...`);

    try {
      const { selectedInterface } = ipv6Status;

      // Generate IPv6 addresses if needed
      let ipv6Addresses = plan.ipv6List;
      if (ipv6Addresses.length < plan.numberOfProxies) {
        const needed = plan.numberOfProxies - ipv6Addresses.length;
        const generated = await api.generateIPv6Addresses(
          selectedInterface.prefixBase,
          selectedInterface.prefix,
          needed
        );
        ipv6Addresses = [...ipv6Addresses, ...generated];
      }

      // Save network config
      await api.saveNetworkConfig({
        name: selectedInterface.name,
        ipv6: selectedInterface.ipv6,
        prefix: selectedInterface.prefix,
        prefixBase: selectedInterface.prefixBase,
      });

      // Set network config for rotation service
      await api.setNetworkConfig(
        selectedInterface.name,
        selectedInterface.prefix,
        selectedInterface.prefixBase
      );

      // Prepare all proxy configs while avoiding existing ports
      const usedPorts = new Set<number>([
        ...proxyConfigs.map((config) => config.port),
        ...proxies.map((proxy) => proxy.port),
      ]);

      const configs = [];
      let nextPortCandidate = plan.portStart;

      for (let i = 0; i < plan.numberOfProxies; i++) {
        if (nextPortCandidate <= plan.portStart) {
          nextPortCandidate = plan.portStart;
        }

        while (usedPorts.has(nextPortCandidate)) {
          nextPortCandidate += 1;
        }

        configs.push({
          id: i, // Will be reassigned by storage service
          type: plan.type,
          port: nextPortCandidate,
          ipv6: ipv6Addresses[i],
          interfaceName: selectedInterface.name,
          prefix: selectedInterface.prefix,
          username: plan.username,
          password: plan.password,
        });

        usedPorts.add(nextPortCandidate);
      }

      // Save configs to storage
      await api.addProxyConfigs(configs);
      await refreshProxyConfigs();
      
      message.success(`Added ${plan.numberOfProxies} proxy configs`);
      addLog('info', `Added ${plan.numberOfProxies} proxy configs`);
    } catch (error: any) {
      message.error(`Failed to add proxies: ${error.message}`);
      addLog('error', `Add proxies failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Start all proxies from saved configs
  const startAllProxies = async () => {
    if (proxyConfigs.length === 0) {
      message.error('No proxy configs to start');
      return;
    }

    setLoading(true);
    addLog('info', `Starting ${proxyConfigs.length} proxies...`);

    try {
      // Start all proxies with a single authentication prompt
      addLog('info', `Starting ${proxyConfigs.length} proxies (authentication required)...`);
      const proxies = await api.startMultipleProxies(proxyConfigs);
      
      // Log each started proxy
      proxies.forEach((proxy) => {
        addLog('info', `Proxy ${proxy.id} started on port ${proxy.port}`, proxy.id);
      });

      await refreshProxies();
      message.success(`Started ${proxyConfigs.length} proxies`);
      addLog('info', `All proxies started successfully`);
    } catch (error: any) {
      message.error(`Failed to start proxies: ${error.message}`);
      addLog('error', `Proxy start failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Stop all proxies
  const stopAllProxies = async () => {
    setLoading(true);
    addLog('info', 'Stopping all proxies...');
    try {
      await api.stopAllProxies();
      await refreshProxies();
      message.success('All proxies stopped');
      addLog('info', 'All proxies stopped');
    } catch (error: any) {
      message.error(`Failed to stop proxies: ${error.message}`);
      addLog('error', `Stop proxies failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete all proxies (stop + remove interfaces + delete configs)
  const deleteAllProxies = async () => {
    setLoading(true);
    addLog('info', 'Deleting all proxies...');
    try {
      await api.deleteAllProxies();
      await refreshProxies();
      await refreshProxyConfigs();
      message.success('All proxies deleted');
      addLog('info', 'All proxies deleted');
    } catch (error: any) {
      message.error(`Failed to delete proxies: ${error.message}`);
      addLog('error', `Delete proxies failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };



  // Copy proxy URI
  const copyProxyURI = async (id: number) => {
    try {
      const uri = await api.getProxyURI(id);
      await navigator.clipboard.writeText(uri);
      message.success('Proxy URI copied to clipboard');
    } catch (error: any) {
      message.error(`Failed to copy URI: ${error.message}`);
    }
  };

  // Health check
  const healthCheckProxy = async (id: number) => {
    try {
      addLog('info', `Running health check for proxy ${id}...`, id);
      const result = await api.healthCheckProxy(id);
      if (result) {
        message.success(`Proxy ${id} is healthy`);
        addLog('info', `Proxy ${id} health check passed`, id);
      } else {
        message.warning(`Proxy ${id} health check failed`);
        addLog('warning', `Proxy ${id} health check failed`, id);
      }
      await refreshProxies();
    } catch (error: any) {
      message.error(`Health check failed: ${error.message}`);
      addLog('error', `Proxy ${id} health check error: ${error.message}`, id);
    }
  };

  // Update rotation config
  const updateRotationConfig = async (config: RotationConfig) => {
    setLoading(true);
    try {
      await api.setRotationConfig(config);
      setRotationConfigState(config);
      
      if (config.mode === 'interval') {
        message.success(`Rotation schedule applied (every ${config.intervalSeconds}s)`);
        addLog('info', `Rotation schedule started: every ${config.intervalSeconds} seconds`);
      } else {
        message.success('Rotation schedule cancelled');
        addLog('info', 'Rotation schedule cancelled');
      }
    } catch (error: any) {
      message.error(`Failed to update rotation config: ${error.message}`);
      addLog('error', `Rotation config update failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Rotate now
  const rotateNow = async () => {
    setLoading(true);
    addLog('info', 'Triggering full pool rotation...');
    try {
      await api.rotateNow();
      await refreshProxies();
      message.success('Rotation completed');
      addLog('info', 'Full pool rotation completed');
    } catch (error: any) {
      message.error(`Rotation failed: ${error.message}`);
      addLog('error', `Rotation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Listen for rotation events
  useEffect(() => {
    const unsubscribe = api.onRotationCompleted((data) => {
      addLog('rotation', `Proxy ${data.proxyId} rotated to ${data.newIPv6}`, data.proxyId);
      refreshProxies();
    });

    return unsubscribe;
  }, []);

  // Initial scan on mount and load saved configs
  useEffect(() => {
    const initialize = async () => {
      // First scan network to get available interfaces
      const interfaces = await scanNetwork();
      
      // Load saved configs
      await refreshProxyConfigs();
      
      // Load saved network interface and restore it
      try {
        const savedInterfaceName = await api.getSavedNetworkInterface();
        if (savedInterfaceName && interfaces) {
          // Find the interface object from the scanned interfaces
          const savedInterface = interfaces.find(
            (iface: NetworkInterface) => iface.name === savedInterfaceName
          );
          if (savedInterface) {
            setIPv6Status((prev) => ({ ...prev, selectedInterface: savedInterface }));
            addLog('info', `Restored network interface: ${savedInterfaceName}`);
          }
        }
      } catch (error: any) {
        addLog('error', `Failed to load saved network interface: ${error.message}`);
      }
    };
    
    initialize();
  }, []);

  // Periodic refresh of proxies
  useEffect(() => {
    const interval = setInterval(() => {
      if (proxies.length > 0) {
        refreshProxies();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [proxies.length]);

  const isDark = themeMode === 'dark';
  const bgColor = isDark ? '#0a0e27' : '#f0f2f5';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 2,
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: bgColor }} className={themeMode}>
        <AppHeader
          connected={ipv6Status.connected}
          onScanNetwork={scanNetwork}
          loading={loading}
          interfaces={ipv6Status.interfaces}
          selectedInterface={ipv6Status.selectedInterface}
          onSelectInterface={async (iface) => {
            setIPv6Status((prev) => ({ ...prev, selectedInterface: iface }));
            try {
              await api.saveNetworkInterface(iface.name);
              addLog('info', `Network interface saved: ${iface.name}`);
            } catch (error: any) {
              addLog('error', `Failed to save network interface: ${error.message}`);
            }
          }}
          onTestConnectivity={testConnectivity}
          onResetInterfaces={resetIPv6Interfaces}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
        />
        <Content 
          style={{ 
            padding: '1px',
            height: 'calc(100vh - 60px)', // Full height minus header
            overflow: 'hidden',
            maxWidth: 1600,
            margin: '0 auto',
            width: '100%',
            display: 'grid',
            gridTemplateRows: `1fr ${logsCollapsed ? '48px' : '300px'}`,
            gridTemplateColumns: '1fr',
            transition: 'grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Main content area - takes remaining space dynamically */}
          <div style={{ 
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <Row gutter={8} style={{ flex: 1, minHeight: 0 }}>
              {/* Left Column: Proxy Configuration + Rotation Control */}
              <Col xs={24} lg={8} style={{ height: '100%' }}>
                <div style={{ 
                  height: '100%', 
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingLeft: '5px',
                  paddingRight: '2px',
                }}>
                  <ProxyConfiguration
                    selectedInterface={ipv6Status.selectedInterface}
                    onAddProxies={addProxies}
                    loading={loading}
                  />

                  <RotationControl
                    config={rotationConfig}
                    onConfigChange={updateRotationConfig}
                    loading={loading}
                    hasProxies={proxies.length > 0}
                  />
                </div>
              </Col>

              {/* Right Column: Proxy List - automatically fills remaining height */}
              <Col xs={24} lg={16} style={{ height: '100%', paddingLeft:'0px' }}>
                <ProxyList
                  proxies={proxies}
                  proxyConfigs={proxyConfigs}
                  onCopyURI={copyProxyURI}
                  onHealthCheck={healthCheckProxy}
                  onStartAllProxies={startAllProxies}
                  onStopAllProxies={stopAllProxies}
                  onDeleteAllProxies={deleteAllProxies}
                  onRotateNow={rotateNow}
                  loading={loading}
                  rotationConfig={rotationConfig}
                />
              </Col>
            </Row>
          </div>

          {/* Bottom Logs Console - fixed at bottom with dynamic height */}
          <div style={{ 
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <LogsConsole 
              logs={logs} 
              onClearLogs={() => setLogs([])}
              collapsed={logsCollapsed}
              onToggleCollapse={() => setLogsCollapsed(!logsCollapsed)}
              themeMode={themeMode}
            />
          </div>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
