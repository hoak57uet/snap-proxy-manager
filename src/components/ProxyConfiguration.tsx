import { useState } from 'react';
import {
  Card,
  Form,
  Radio,
  InputNumber,
  Input,
  Button,
  Space,
  message,
  Divider,
  Switch,
} from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { NetworkInterface } from '../hooks/useProxyAPI';

const { TextArea } = Input;

interface ProxyConfigurationProps {
  selectedInterface?: NetworkInterface;
  onAddProxies: (plan: {
    type: 'HTTP' | 'SOCKS5';
    numberOfProxies: number;
    portStart: number;
    username?: string;
    password?: string;
    ipv6List: string[];
  }) => void;
  loading: boolean;
}

export const ProxyConfiguration: React.FC<ProxyConfigurationProps> = ({
  selectedInterface,
  onAddProxies,
  loading,
}) => {
  const [form] = Form.useForm();
  const [enableAuth, setEnableAuth] = useState(false);
  const [enableManualIPv6, setEnableManualIPv6] = useState(false);

  const handleAdd = () => {
    form.validateFields().then((values) => {
      const { type, numberOfProxies, portStart, username, password, ipv6Manual } = values;

      // Parse manual IPv6 list only if enabled
      const ipv6List = enableManualIPv6 && ipv6Manual
        ? ipv6Manual
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
        : [];

      if (!selectedInterface) {
        message.error('Please select a network interface first');
        return;
      }

      onAddProxies({
        type,
        numberOfProxies,
        portStart,
        username: enableAuth && username ? username : undefined,
        password: enableAuth && password ? password : undefined,
        ipv6List,
      });
    });
  };

  return (
    <>
      <Card 
        title="🧱 Proxy Configuration" 
        style={{ marginBottom: 1 }}
        bodyStyle={{ padding: 16 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'HTTP',
            numberOfProxies: 10,
            portStart: 30000,
            rotationMode: 'manual',
          }}
        >
          <Form.Item label="Proxy Type" name="type" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="HTTP">HTTP</Radio.Button>
              <Radio.Button value="SOCKS5">SOCKS5</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Space size="middle" style={{ width: '100%' }} wrap>
            <Form.Item
              label="Number of Proxies"
              name="numberOfProxies"
              rules={[{ required: true, type: 'number', min: 1, max: 1000 }]}
              style={{ marginBottom: 8 }}
            >
              <InputNumber min={1} max={1000} style={{ width: 150 }} />
            </Form.Item>

            <Form.Item
              label="Listen Port Start"
              name="portStart"
              rules={[{ required: true, type: 'number', min: 1024, max: 65535 }]}
              style={{ marginBottom: 8 }}
            >
              <InputNumber min={1024} max={65535} style={{ width: 150 }} />
            </Form.Item>
          </Space>

          <Divider />

          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 8 
            }}>
              <span style={{ fontWeight: 500 }}>Username/Password Authentication</span>
              <Switch 
                checked={enableAuth} 
                onChange={setEnableAuth}
                size="small"
              />
            </div>
            {enableAuth && (
              <div style={{ marginTop: 12, paddingLeft: 24 }}>
                <Space size="large" style={{ width: '100%' }} wrap>
                  <Form.Item label="Username" name="username">
                    <Input placeholder="Enter username" style={{ width: 200 }} />
                  </Form.Item>

                  <Form.Item label="Password" name="password">
                    <Input.Password 
                      placeholder="Enter password" 
                      style={{ width: 200 }} 
                      bordered={false}
                      styles={{
                        input: {
                          border: 'none',
                          borderBottom: '1px solid #d9d9d9',
                          borderRadius: 0,
                          padding: '4px 0',
                        }
                      }}
                    />
                  </Form.Item>
                </Space>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 8 
            }}>
              <span style={{ fontWeight: 500 }}>Manual IPv6 List</span>
              <Switch 
                checked={enableManualIPv6} 
                onChange={setEnableManualIPv6}
                size="small"
              />
            </div>
            {enableManualIPv6 && (
              <div style={{ marginTop: 12, paddingLeft: 24 }}>
                <Form.Item
                  name="ipv6Manual"
                  extra="One IPv6 address per line. If provided less than needed, remaining will be auto-generated."
                >
                  <TextArea
                    rows={4}
                    placeholder="2405:4802:1fe:f7d0::1&#10;2405:4802:1fe:f7d0::2&#10;..."
                  />
                </Form.Item>
              </div>
            )}
          </div>

          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleAdd}
              loading={loading}
              disabled={!selectedInterface}
            >
              Add Proxies
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  );
};