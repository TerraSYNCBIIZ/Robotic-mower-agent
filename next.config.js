/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['api.amc.husqvarna.dev'],
    unoptimized: true,
  },
  transpilePackages: ['@react-google-maps/api'],
};

module.exports = nextConfig; 