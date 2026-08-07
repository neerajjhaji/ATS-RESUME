/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse and mammoth are heavy Node-only libs; keep them external to the
  // server bundle so Next doesn't try to bundle their internal test fixtures.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

module.exports = nextConfig;
