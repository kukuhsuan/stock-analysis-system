import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow longer execution time for AI analysis on Vercel
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
