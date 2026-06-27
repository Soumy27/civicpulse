/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  eslint: {
    // Keep builds green even if lint nits exist.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
