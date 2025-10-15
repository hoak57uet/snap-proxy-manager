// Shared types for IPv6 Proxy Manager

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

export interface ProxyPlan {
  type: 'HTTP' | 'SOCKS5';
  numberOfProxies: number;
  portStart: number;
  username?: string;
  password?: string;
  ipv6List: string[];
  rotationMode: 'manual' | 'interval';
  rotationInterval?: number;
}

export interface RotationConfig {
  mode: 'manual' | 'interval';
  intervalSeconds?: number;
  staggerEnabled: boolean;
  staggerSeconds?: number;
  gracefulEnabled: boolean;
  drainTimeout?: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'rotation';
  proxyId?: number;
  message: string;
}

export interface IPv6Status {
  connected: boolean;
  interfaces: NetworkInterface[];
  selectedInterface?: string;
}

export interface AppState {
  ipv6Status: IPv6Status;
  proxies: ProxyConfig[];
  rotationConfig: RotationConfig;
  logs: LogEntry[];
}