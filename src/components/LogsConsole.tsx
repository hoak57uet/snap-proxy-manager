import { Card, Table, Tag, Button, Space, Select } from 'antd';
import { ClearOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useState } from 'react';
import dayjs from 'dayjs';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'rotation';
  proxyId?: number;
  message: string;
}

interface LogsConsoleProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  themeMode?: 'dark' | 'light';
}

export const LogsConsole: React.FC<LogsConsoleProps> = ({ logs, onClearLogs, collapsed, onToggleCollapse, themeMode = 'dark' }) => {
  const [levelFilter, setLevelFilter] = useState<string>('all');

  // Theme colors
  const isDarkMode = themeMode === 'dark';
  const borderColor = isDarkMode ? '#1f2937' : '#d9d9d9';
  const bgColor = isDarkMode ? '#0a0e27' : '#f0f2f5';

  // No longer need animation callbacks since CSS Grid handles transitions

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesLevel;
  });

  const columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const levelConfig: Record<string, { color: string; icon: string }> = {
          info: { color: 'blue', icon: '✅' },
          warning: { color: 'warning', icon: '⚠️' },
          error: { color: 'error', icon: '❌' },
          rotation: { color: 'purple', icon: '🔁' },
        };
        const config = levelConfig[level] || levelConfig.info;
        return (
          <Tag color={config.color}>
            {config.icon} {level.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Proxy ID',
      dataIndex: 'proxyId',
      key: 'proxyId',
      width: 100,
      render: (id?: number) => (id !== undefined ? <Tag>{id}</Tag> : '-'),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  return (
    <div
      style={{
        background: bgColor,
        borderTop: `1px solid ${borderColor}`,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Card
        title={
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={onToggleCollapse}
          >
            <span style={{ fontSize: '13px' }}>📋 Logs & Console ({filteredLogs.length})</span>
            <Button
              type="text"
              icon={collapsed ? <UpOutlined /> : <DownOutlined />}
              onClick={(e) => {
                e.stopPropagation(); // Prevent double trigger
                onToggleCollapse();
              }}
              size="small"
            />
          </div>
        }
        extra={
          !collapsed && (
            <Space>
              <Select
                size="small"
                style={{ width: 120 }}
                value={levelFilter}
                onChange={setLevelFilter}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Info', value: 'info' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Error', value: 'error' },
                  { label: 'Rotation', value: 'rotation' },
                ]}
              />
              <Button size="small" danger icon={<ClearOutlined />} onClick={onClearLogs}>
                Clear
              </Button>
            </Space>
          )
        }
        bodyStyle={{ 
          padding: collapsed ? 0 : 16, 
          display: collapsed ? 'none' : 'block',
        }}
        style={{ 
          margin: 0, 
          borderRadius: 0, 
          height: '100%',
        }}
      >
        {!collapsed && (
          <Table
            columns={columns}
            dataSource={filteredLogs}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 800, y: 'calc(100vh - 250px)' }}
            bordered={false}
            showHeader={false}
            style={{ fontSize: '12px' }}
            className="logs-table"
          />
        )}
      </Card>
    </div>
  );
};