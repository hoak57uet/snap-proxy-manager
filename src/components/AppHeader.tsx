import { Layout, Typography, Button, Space, Badge, Select } from 'antd';
import { ReloadOutlined, WifiOutlined, DisconnectOutlined, ThunderboltOutlined, BulbOutlined, BulbFilled, ClearOutlined } from '@ant-design/icons';
import { NetworkInterface } from '../hooks/useProxyAPI';

const { Header } = Layout;
const { Title } = Typography;

interface AppHeaderProps {
  connected: boolean;
  onScanNetwork: () => void;
  loading: boolean;
  interfaces: NetworkInterface[];
  selectedInterface?: NetworkInterface;
  onSelectInterface: (iface: NetworkInterface) => void;
  onTestConnectivity: () => void;
  onResetInterfaces: () => void;
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ 
  connected, 
  onScanNetwork, 
  loading,
  interfaces,
  selectedInterface,
  onSelectInterface,
  onTestConnectivity,
  onResetInterfaces,
  themeMode,
  onToggleTheme,
}) => {
  const isDark = themeMode === 'dark';
  const headerBg = isDark ? '#141824' : '#ffffff';
  const borderColor = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#fff' : '#000';
  const secondaryTextColor = isDark ? '#8b92a7' : '#6b7280';

  return (
    <Header
      style={{
        background: headerBg,
        padding: '8px 24px',
        borderBottom: `1px solid ${borderColor}`,
        height: 'auto',
        lineHeight: 'normal',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Single Row Layout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Left: Title + Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={4} style={{ margin: 0, color: textColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 16 }}>
            Snap Proxy IPv6 Manager
          </Title>
          <Badge
            status={connected ? 'success' : 'error'}
            text={
              <span style={{ color: connected ? '#52c41a' : '#ff4d4f', fontWeight: 500, fontSize: 11 }}>
                {connected ? (
                  <>
                    <WifiOutlined /> Connected
                  </>
                ) : (
                  <>
                    <DisconnectOutlined /> Disconnected
                  </>
                )}
              </span>
            }
          />
        </div>

        {/* Center: Network Information - Single Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: secondaryTextColor }}>Interface:</span>
            <Select
              size="small"
              style={{ width: 110, fontSize: 11 }}
              value={selectedInterface?.name}
              onChange={(value) => {
                const iface = interfaces.find((i) => i.name === value);
                if (iface) onSelectInterface(iface);
              }}
              options={Array.from(new Set(interfaces.map((i) => i.name))).map((name) => ({
                label: name,
                value: name,
              }))}
              placeholder="Select"
            />
            <Button
              icon={<ClearOutlined />}
              onClick={onResetInterfaces}
              disabled={!selectedInterface}
              size="small"
              title="Reset IPv6 Interfaces - Remove all custom IPv6 addresses"
              danger
            >
              Reset
            </Button>
          </div>
          
          {selectedInterface && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: secondaryTextColor, fontSize: 10 }}>IPv6:</span>
                <span style={{ color: textColor, fontSize: 10 }}>{selectedInterface.ipv6}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: secondaryTextColor, fontSize: 10 }}>Prefix:</span>
                <span style={{ color: textColor, fontSize: 10 }}>/{selectedInterface.prefix}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: secondaryTextColor, fontSize: 10 }}>Base:</span>
                <span style={{ color: textColor, fontSize: 10 }}>{selectedInterface.prefixBase}</span>
              </div>
            </>
          )}
        </div>

        {/* Right: Action Buttons */}
        <Space size="small">
          <Button
            icon={isDark ? <BulbOutlined /> : <BulbFilled />}
            onClick={onToggleTheme}
            size="small"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          />
          <Button
            icon={<ThunderboltOutlined />}
            onClick={onTestConnectivity}
            loading={loading}
            disabled={!selectedInterface}
            size="small"
          >
            Test
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={onScanNetwork}
            loading={loading}
            type="primary"
            size="small"
          >
            Scan
          </Button>
        </Space>
      </div>
    </Header>
  );
};