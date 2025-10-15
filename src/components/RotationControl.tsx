import { Card, Form, InputNumber, Switch, Button } from 'antd';
import { RotationConfig } from '../hooks/useProxyAPI';
import { useEffect } from 'react';

interface RotationControlProps {
  config: RotationConfig;
  onConfigChange: (config: RotationConfig) => void;
  loading: boolean;
  hasProxies: boolean;
}

export const RotationControl: React.FC<RotationControlProps> = ({
  config,
  onConfigChange,
  loading,
  hasProxies,
}) => {
  const [form] = Form.useForm();
  const isScheduleActive = config.mode === 'interval';

  useEffect(() => {
    form.setFieldsValue(config);
  }, [config, form]);

  const handleApplyOrCancelSchedule = () => {
    const values = form.getFieldsValue();
    
    if (isScheduleActive) {
      // Cancel schedule - switch to manual mode
      const newConfig: RotationConfig = {
        mode: 'manual',
        intervalSeconds: values.intervalSeconds,
        staggerEnabled: false,
        staggerSeconds: undefined,
        gracefulEnabled: values.gracefulEnabled,
        drainTimeout: values.drainTimeout,
      };
      onConfigChange(newConfig);
    } else {
      // Apply schedule - switch to interval mode
      const newConfig: RotationConfig = {
        mode: 'interval',
        intervalSeconds: values.intervalSeconds,
        staggerEnabled: false,
        staggerSeconds: undefined,
        gracefulEnabled: values.gracefulEnabled,
        drainTimeout: values.drainTimeout,
      };
      onConfigChange(newConfig);
    }
  };

  return (
    <Card 
      title="⏱️ Interval Rotation" 
      style={{ marginBottom: 1, marginTop: 24 }}
      bodyStyle={{ padding: 16 }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={config}
      >
        <Form.Item
          label="Rotate Full Pool Every (seconds)"
          name="intervalSeconds"
          rules={[{ required: true, type: 'number', min: 10 }]}
        >
          <InputNumber
            min={10}
            max={86400}
            style={{ width: '100%' }}
            placeholder="e.g., 300"
            disabled={isScheduleActive}
          />
        </Form.Item>

        <Button
          type={isScheduleActive ? "default" : "primary"}
          danger={isScheduleActive}
          onClick={handleApplyOrCancelSchedule}
          loading={loading}
          disabled={!hasProxies}
          style={{ width: '100%' }}
        >
          {isScheduleActive ? 'Cancel Schedule' : 'Apply Schedule'}
        </Button>

        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 8 
          }}>
            <span style={{ fontWeight: 500 }}>Graceful Rotation</span>
            <Form.Item name="gracefulEnabled" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
          </div>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.gracefulEnabled !== curr.gracefulEnabled}>
            {({ getFieldValue }) =>
              getFieldValue('gracefulEnabled') ? (
                <div style={{ marginTop: 12, paddingLeft: 24 }}>
                  <Form.Item
                    label="Drain Timeout (milliseconds)"
                    name="drainTimeout"
                    rules={[{ required: true, type: 'number', min: 1000 }]}
                  >
                    <InputNumber min={1000} max={120000} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
              ) : null
            }
          </Form.Item>
        </div>
      </Form>
    </Card>
  );
};