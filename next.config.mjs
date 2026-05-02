/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    // Optimize heavy packages by only importing what is used
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      '@react-pdf/renderer',
      'exceljs',
      'jspdf',
      'jspdf-autotable',
      'transliteration',
      'clsx',
      'tailwind-merge',
      'sonner',
      '@radix-ui/react-progress',
      '@hookform/resolvers',
      'react-hook-form',
      'zod'
    ],
  },
  // Turbopack config required in Next.js 16+ when webpack config exists
  turbopack: {},
  // Keep webpack config for build compatibility
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
