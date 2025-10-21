import { Card, Table, Tag, Button, Space, Tooltip, Typography, Dropdown, Checkbox, message as antMessage, Modal } from 'antd';
import type { MenuProps } from 'antd';
import {
  StopOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { ProxyConfig, RotationConfig } from '../hooks/useProxyAPI';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useState, useEffect, useRef } from 'react';

dayjs.extend(relativeTime);

const { Text } = Typography;

type ProxyPattern = 'pattern1' | 'pattern2' | 'pattern3';

const PROXY_PATTERNS: Record<ProxyPattern, {
  label: string;
  format: (proxy: ProxyConfig, useLan: boolean, formattedAddress: string, useSSL: boolean) => string;
  labelWithAddress: (proxy: ProxyConfig, useLan: boolean, formattedAddress: string) => string;
}> = {
  pattern1: {
    label: 'protocol://username:password@ip:port',
    format: (proxy: ProxyConfig, _useLan, formattedAddress, useSSL) => {
      const baseProtocol = proxy.type.toLowerCase();
      const protocol = useSSL ? `${baseProtocol}s` : baseProtocol;
      const hasAuth = proxy.username && proxy.password;
      return hasAuth
        ? `${protocol}://${proxy.username}:${proxy.password}@${formattedAddress}:${proxy.port}`
        : `${protocol}://${formattedAddress}:${proxy.port}`;
    },
    labelWithAddress: (proxy: ProxyConfig, useLan, formattedAddress) => {
      if (!useLan) {
        return 'protocol://username:password@127.0.0.1:port';
      }
      const protocol = proxy.type.toLowerCase();
      const hasAuth = proxy.username && proxy.password;
      return hasAuth
        ? `${protocol}://${proxy.username}:${proxy.password}@${formattedAddress}:${proxy.port}`
        : `${protocol}://${formattedAddress}:${proxy.port}`;
    },
  },
  pattern2: {
    label: 'protocol://username:password:ip:port',
    format: (proxy: ProxyConfig, _useLan, formattedAddress, useSSL) => {
      const baseProtocol = proxy.type.toLowerCase();
      const protocol = useSSL ? `${baseProtocol}s` : baseProtocol;
      const hasAuth = proxy.username && proxy.password;
      return hasAuth
        ? `${protocol}://${proxy.username}:${proxy.password}:${formattedAddress}:${proxy.port}`
        : `${protocol}://${formattedAddress}:${proxy.port}`;
    },
    labelWithAddress: (proxy: ProxyConfig, useLan, formattedAddress) => {
      if (!useLan) {
        return 'protocol://username:password:127.0.0.1:port';
      }
      const protocol = proxy.type.toLowerCase();
      const hasAuth = proxy.username && proxy.password;
      return hasAuth
        ? `${protocol}://${proxy.username}:${proxy.password}:${formattedAddress}:${proxy.port}`
        : `${protocol}://${formattedAddress}:${proxy.port}`;
    },
  },
  pattern3: {
    label: 'protocol://ip:port:username:password',
    format: (proxy: ProxyConfig, _useLan, formattedAddress, useSSL) => {
      const baseProtocol = proxy.type.toLowerCase();
      const protocol = useSSL ? `${baseProtocol}s` : baseProtocol;
      const hasAuth = proxy.username && proxy.password;
      return hasAuth
        ? `${protocol}://${formattedAddress}:${proxy.port}:${proxy.username}:${proxy.password}`
        : `${protocol}://${formattedAddress}:${proxy.port}`;
    },
    labelWithAddress: (proxy: ProxyConfig, useLan, formattedAddress) => {
      if (!useLan) {
        return 'protocol://127.0.0.1:port:username:password';
      }
      const protocol = proxy.type.toLowerCase();
      const hasAuth = proxy.username && proxy.password;
      return hasAuth
        ? `${protocol}://${formattedAddress}:${proxy.port}:${proxy.username}:${proxy.password}`
        : `${protocol}://${formattedAddress}:${proxy.port}`;
    },
  },
};

interface ProxyListProps {
  proxies: ProxyConfig[];
  proxyConfigs: any[];
  onStopProxy?: (id: number) => void;
  onRotateProxy?: (id: number) => void;
  onCopyURI: (id: number) => void;
  onHealthCheck: (id: number) => void;
  onStartAllProxies: () => void;
  onStopAllProxies: () => void;
  onDeleteAllProxies: () => void;
  onRotateNow: () => void;
  loading: boolean;
  rotationConfig: RotationConfig;
}

export const ProxyList: React.FC<ProxyListProps> = ({
  proxies,
  proxyConfigs,

  onCopyURI,
  onHealthCheck,
  onStartAllProxies,
  onStopAllProxies,
  onDeleteAllProxies,
  onRotateNow,
  loading,
  rotationConfig,
}) => {
  const hasRunningProxies = proxies.length > 0;
  const hasConfigs = proxyConfigs.length > 0;
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<ProxyPattern>('pattern1');
  // Countdown timer for interval rotation
  useEffect(() => {
    if (rotationConfig.mode === 'interval' && rotationConfig.intervalSeconds && hasRunningProxies) {
      // Initialize countdown
      setCountdown(rotationConfig.intervalSeconds);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            return rotationConfig.intervalSeconds || null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [rotationConfig.mode, rotationConfig.intervalSeconds, hasRunningProxies]);

  const formatCountdown = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Copy all proxies with selected pattern
  const handleCopyAll = async () => {
    if (displayData.length === 0) {
      antMessage.warning('No proxies to copy');
      return;
    }

    const formatter = PROXY_PATTERNS[selectedPattern].format;
    const proxyList = displayData
      .map((proxy) => formatter(proxy, useLanIP, formatAddress(proxy), useSSL))
      .join('\n');

    try {
      await navigator.clipboard.writeText(proxyList);
      antMessage.success(`Copied ${displayData.length} proxies to clipboard`);
    } catch (error) {
      antMessage.error('Failed to copy to clipboard');
    }
  };

  // Handle Stop All with confirmation
  const handleStopAllWithConfirmation = () => {
    Modal.confirm({
      title: 'Stop All Proxies',
      content: `Are you sure you want to stop all ${proxies.length} running proxies?`,
      okText: 'Yes, Stop All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: onStopAllProxies,
    });
  };

  // Handle Delete All with confirmation
  const handleDeleteAllWithConfirmation = () => {
    Modal.confirm({
      title: 'Delete All Proxies',
      content: `Are you sure you want to delete all proxy configurations and stop all running proxies? This action cannot be undone.`,
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: onDeleteAllProxies,
    });
  };

  const [useLanIP, setUseLanIP] = useState<boolean>(false);
  const [useSSL, setUseSSL] = useState<boolean>(true);
  const [detectedLanIP, setDetectedLanIP] = useState<string | null>(null);
  const [tableHeight, setTableHeight] = useState<number>(400);
  const cardRef = useRef<HTMLDivElement>(null);

  // Detect LAN IP on component mount
  useEffect(() => {
    const detectLanIP = async () => {
      try {
        // Use the Electron IPC to detect LAN IP
        const result = await window.ipcRenderer.invoke('ipv6:detect-lan-ip');
        if (result.success && result.data) {
          setDetectedLanIP(result.data);
          console.log('Detected LAN IP:', result.data);
        }
      } catch (error) {
        console.error('Failed to detect LAN IP:', error);
      }
    };
    detectLanIP();
  }, []);

  // Calculate table height dynamically
  useEffect(() => {
    const calculateHeight = () => {
      if (cardRef.current) {
        const cardRect = cardRef.current.getBoundingClientRect();
        const cardHeader = cardRef.current.querySelector('.ant-card-head');
        const cardHeaderHeight = cardHeader ? cardHeader.getBoundingClientRect().height : 0;
        const availableHeight = cardRect.height - cardHeaderHeight - 100; // 100px for padding and pagination
        const newHeight = Math.max(300, availableHeight);
        
        // Only update if height changed significantly to avoid unnecessary re-renders
        setTableHeight(prev => Math.abs(prev - newHeight) > 10 ? newHeight : prev);
      }
    };

    // Initial calculation with delay to ensure DOM is ready
    const timer = setTimeout(calculateHeight, 150);
    
    // Recalculate on window resize with debounce
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateHeight, 100);
    };
    window.addEventListener('resize', debouncedResize);
    
    // Recalculate when component updates (e.g., logs console collapse/expand)
    const observer = new ResizeObserver(() => {
      // Add delay to sync with CSS transition
      setTimeout(calculateHeight, 300);
    });
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
      observer.disconnect();
    };
  }, []);

  // Dropdown menu for pattern selection
  const patternMenuItems: MenuProps['items'] = [
    {
      key: 'pattern1',
      label: PROXY_PATTERNS.pattern1.label,
      onClick: () => setSelectedPattern('pattern1'),
    },
    {
      key: 'pattern2',
      label: PROXY_PATTERNS.pattern2.label,
      onClick: () => setSelectedPattern('pattern2'),
    },
    {
      key: 'pattern3',
      label: PROXY_PATTERNS.pattern3.label,
      onClick: () => setSelectedPattern('pattern3'),
    },
  ];

  const formatAddress = (proxy: ProxyConfig): string => {
    if (!useLanIP) {
      return '127.0.0.1';
    }

    // Use detected LAN IP from frontend if available
    if (detectedLanIP) {
      return detectedLanIP;
    }

    // Fallback to proxy's lanIp if available
    if (proxy.lanIp) {
      return proxy.lanIp;
    }

    // Fallback to IPv6
    const ipv6 = proxy.ipv6;

    if (ipv6 && ipv6.includes('::')) {
      return ipv6;
    }

    if (ipv6) {
      return ipv6;
    }

    return '127.0.0.1';
  };

  // Merge configs and running proxies into a single display list
  const displayData = proxyConfigs.map((config) => {
    const runningProxy = proxies.find((p) => p.id === config.id);
    if (runningProxy) {
      // If proxy is running, use the running proxy data
      return runningProxy;
    } else {
      // If proxy is not running, show config with 'stopped' status
      return {
        ...config,
        status: 'stopped',
        healthCheckStatus: undefined,
        lastRotated: undefined,
      };
    }
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      sorter: (a: ProxyConfig, b: ProxyConfig) => a.id - b.id,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'HTTP' ? 'blue' : 'purple'}>{type}</Tag>
      ),
    },
    {
      title: 'Port',
      dataIndex: 'port',
      key: 'port',
      width: 100,
      sorter: (a: ProxyConfig, b: ProxyConfig) => a.port - b.port,
    },
    {
      title: 'Bound IPv6',
      dataIndex: 'ipv6',
      key: 'ipv6',
      ellipsis: true,
      render: (ipv6: string) => (
        <Tooltip title={ipv6}>
          <Text code copyable style={{ fontSize: 12 }}>
            {ipv6}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username?: string) => username || <Text type="secondary">None</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; icon: any }> = {
          running: { color: 'success', icon: <CheckCircleOutlined /> },
          stopped: { color: 'default', icon: <CloseCircleOutlined /> },
          error: { color: 'error', icon: <ExclamationCircleOutlined /> },
          draining: { color: 'warning', icon: <SyncOutlined spin /> },
        };
        const config = statusConfig[status] || statusConfig.stopped;
        return (
          <Tag color={config.color} icon={config.icon}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Health',
      dataIndex: 'healthCheckStatus',
      key: 'healthCheckStatus',
      width: 100,
      render: (health?: string) => {
        if (!health) return <Text type="secondary">-</Text>;
        const healthConfig: Record<string, { color: string; text: string }> = {
          healthy: { color: 'success', text: '✓ Healthy' },
          unhealthy: { color: 'error', text: '✗ Unhealthy' },
          checking: { color: 'processing', text: '⟳ Checking' },
        };
        const config = healthConfig[health] || { color: 'default', text: '-' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Last Rotated',
      dataIndex: 'lastRotated',
      key: 'lastRotated',
      width: 150,
      render: (date?: Date) => {
        if (!date) return <Text type="secondary">Never</Text>;
        
        const now = dayjs();
        const rotatedTime = dayjs(date);
        const diffSeconds = now.diff(rotatedTime, 'second');
        const diffMinutes = now.diff(rotatedTime, 'minute');
        const diffHours = now.diff(rotatedTime, 'hour');
        const diffDays = now.diff(rotatedTime, 'day');
        
        let displayText = '';
        if (diffSeconds < 60) {
          displayText = `${diffSeconds}s ago`;
        } else if (diffMinutes < 60) {
          displayText = `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
          displayText = `${diffHours}h ago`;
        } else {
          displayText = `${diffDays}d ago`;
        }
        
        return (
          <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
            {displayText}
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: ProxyConfig) => (
        <Space size="small">
          <Tooltip title="Copy URI">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onCopyURI(record.id)}
            />
          </Tooltip>
          <Tooltip title="Health Check">
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => onHealthCheck(record.id)}
              disabled={record.status !== 'running'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      ref={cardRef}
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Proxies ({proxies.length} active / {proxyConfigs.length})</span>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={onStartAllProxies}
                loading={loading}
                disabled={!hasConfigs || hasRunningProxies}
                size="small"
              >
                Start Proxies
              </Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={onRotateNow}
                loading={loading}
                disabled={!hasRunningProxies}
                size="small"
              >
                Rotate Now
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStopAllWithConfirmation}
                loading={loading}
                disabled={!hasRunningProxies}
                size="small"
              >
                Stop All
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDeleteAllWithConfirmation}
                loading={loading}
                disabled={!hasConfigs && !hasRunningProxies}
                size="small"
              >
                Delete All
              </Button>
            </Space>
          </div>
          {countdown !== null && (
            <div style={{ 
              fontSize: 12, 
              color: '#52c41a',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <SyncOutlined spin />
              <span>Next rotation in: <strong>{formatCountdown(countdown)}</strong></span>
            </div>
          )}
        </div>
      }
      style={{ 
        marginBottom: 1, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column' 
      }}
      bodyStyle={{ 
        padding: '0 0 8px 0', 
        flex: 1, 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column' 
      }}
    >
      <Table
        columns={columns}
        dataSource={displayData}
        rowKey="id"
        pagination={{ 
          pageSize: 20, 
          showSizeChanger: true,
          size: 'small',
          style: { margin: '0 0 8px 0', padding: 0 },
          showTotal: (total) => (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              flexWrap: 'nowrap',
              minWidth: 0,
              overflow: 'hidden'
            }}>
              <Space.Compact style={{ flexShrink: 0 }}>
                <Button
                  icon={<CopyOutlined />}
                  onClick={handleCopyAll}
                  disabled={displayData.length === 0}
                  size="small"
                >
                  Copy All
                </Button>
                <Dropdown menu={{ items: patternMenuItems, selectedKeys: [selectedPattern] }} trigger={['click']}>
                  <Button size="small" icon={<DownOutlined />}>
                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {PROXY_PATTERNS[selectedPattern].label}
                    </span>
                  </Button>
                </Dropdown>
              </Space.Compact>
              <Checkbox
                checked={useLanIP}
                onChange={(event) => setUseLanIP(event.target.checked)}
                disabled={displayData.length === 0}
                style={{ flexShrink: 0 }}
              >
                LAN IP
              </Checkbox>
              <Checkbox
                checked={useSSL}
                onChange={(event) => setUseSSL(event.target.checked)}
                disabled={displayData.length === 0}
                style={{ flexShrink: 0 }}
              >
                SSL
              </Checkbox>
              <Text type="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                Total {total}
              </Text>
            </div>
          )
        }}
        size="small"
        scroll={{ x: 1200, y: tableHeight }}
        style={{ margin: '0px', flex: 1 }}
        className="proxy-list-table"
      />
    </Card>
  );
};