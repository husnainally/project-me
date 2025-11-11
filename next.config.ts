import type { NextConfig } from "next";
import { baseURL } from "./baseUrl";

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Provide __dirname and __filename for dependencies that use CommonJS
      // This is needed for packages like mcp-handler that may use __dirname
      // Setting these to true tells webpack to provide the actual Node.js values
      // instead of trying to polyfill them
      config.node = {
        ...config.node,
        __dirname: true,
        __filename: true,
      };
    }

    return config;
  },
};

export default nextConfig;
