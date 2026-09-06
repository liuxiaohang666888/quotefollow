const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (cb) => cb;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        nextjs: {
          name: 'nextjs',
          chunks: 'all',
          test: /[\\/]node_modules[\\/](react|react-dom|next|@next|@babel)[\\/]/,
          priority: 40,
        },
        ui: {
          name: 'ui',
          test: /[\\/]node_modules[\\/](tailwind|@headlessui|lucide-react|recharts|date-fns|clsx|framer-motion)[\\/]/,
          priority: 30,
          reuseExistingChunk: true,
        },
        api: {
          name: 'api',
          test: /[\\/]node_modules[\\/](resend|openai|mailparser|@supabase)[\\/]/,
          priority: 20,
          reuseExistingChunk: true,
        },
      },
    };
    return config;
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.paypal.com https://js.braintreegateway.com",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://api-m.paypal.com https://api.openai.com https://api.resend.com https://*.supabase.co https://*.voxalo.top",
              "img-src 'self' data: https://*.supabase.co",
              "frame-src https://www.paypal.com",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
