/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Optimize heavy packages by only importing what is used
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  // Ensure we don't try to build native modules that might fail in some environments
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
