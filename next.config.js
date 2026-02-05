/** @type {import('next').NextConfig} */
const nextConfig = {
  // React strict mode for development
  reactStrictMode: true,

  // Enable experimental features
  experimental: {
    // Server Actions (stable in Next.js 14)
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Disabled to reduce build memory usage
    // optimizePackageImports: [
    //   'lucide-react',
    //   '@radix-ui/react-icons',
    //   'date-fns',
    // ],
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'BaaS Dashboard',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },

  // Redirects
  async redirects() {
    return [];
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Webpack customization
  webpack: (config, { isServer }) => {
    // Fix for some packages that have issues with Edge runtime
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

  // TypeScript and ESLint
  typescript: {
    // Allow production builds even with type errors (not recommended)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow production builds even with lint errors (not recommended)
    ignoreDuringBuilds: true,
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Output configuration
  // output: 'standalone', // Disabled to reduce build memory usage
};

module.exports = nextConfig;
