declare module "next-pwa" {
  import type { NextConfig } from "next";

  type WithPWAInitOptions = {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    [key: string]: unknown;
  };

  export default function withPWAInit(options?: WithPWAInitOptions): (nextConfig: NextConfig) => NextConfig;
}

