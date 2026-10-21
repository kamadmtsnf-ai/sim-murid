import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {"/api/**":["./assets/fonts/DejaVuSans.ttf"]},
};

export default nextConfig;
