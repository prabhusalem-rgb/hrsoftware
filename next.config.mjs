/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Output standalone for smaller deployment bundle
  output: 'standalone',

  // React Compiler for automatic memoization (Next.js 16+)
  reactCompiler: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

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
    // Server actions with optimized payload size
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Turbopack config
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
