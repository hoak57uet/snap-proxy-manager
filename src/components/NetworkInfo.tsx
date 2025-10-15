import { Card, Descriptions, Select, Button, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { NetworkInterface } from '../hooks/useProxyAPI';

const { Text } = Typography;

interface NetworkInfoProps {
  interfaces: NetworkInterface[];
  selectedInterface?: NetworkInterface;
  onSelectInterface: (iface: NetworkInterface) => void;
  onTestConnectivity: () => void;
  loading: boolean;
}

export const NetworkInfo: React.FC<NetworkInfoProps> = ({
  interfaces,
  selectedInterface,
  onSelectInterface,
  onTestConnectivity,
  loading,
}) => {
  return (
    <Card
      title="🌐 Network Information"
      style={{ marginBottom: 24 }}
      extra={
        <Button
          icon={<ThunderboltOutlined />}
          onClick={onTestConnectivity}
          loading={loading}
          disabled={!selectedInterface}
        >
          Test Connectivity
        </Button>
      }
    >
      <Descriptions column={2} bordered>
        <Descriptions.Item label="Interface">
          <Select
            style={{ width: 200 }}
            value={selectedInterface?.name}
            onChange={(value) => {
              const iface = interfaces.find((i) => i.name === value);
              if (iface) onSelectInterface(iface);
            }}
            options={interfaces.map((i) => ({
              label: i.name,
              value: i.name,
            }))}
            placeholder="Select interface"
          />
        </Descriptions.Item>
        <Descriptions.Item label="Detected IPv6">
          <Text code copyable={!!selectedInterface}>
            {selectedInterface?.ipv6 || 'N/A'}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Prefix">
          <Text strong>/{selectedInterface?.prefix || 'N/A'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Prefix Base">
          <Text code copyable={!!selectedInterface}>
            {selectedInterface?.prefixBase || 'N/A'}
          </Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};