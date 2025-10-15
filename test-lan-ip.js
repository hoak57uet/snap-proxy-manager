import os from 'os';

function detectLanIPv4() {
  const networkInterfaces = os.networkInterfaces();

  for (const addrs of Object.values(networkInterfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      // Look for IPv4 addresses that are not internal (not 127.0.0.1)
      // and are in private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (addr.family === 'IPv4' && !addr.internal) {
        const ip = addr.address;
        // Check if it's a private IP address
        if (
          ip.startsWith('192.168.') ||
          ip.startsWith('10.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
        ) {
          return ip;
        }
      }
    }
  }

  return undefined;
}

console.log('Detected LAN IP:', detectLanIPv4());