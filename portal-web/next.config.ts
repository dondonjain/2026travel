import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.0.103',
    '192.168.0.103:3000',
    '192.168.0.111',
    '192.168.0.111:3000',
    'localhost:3000'
  ],
};

export default nextConfig;
