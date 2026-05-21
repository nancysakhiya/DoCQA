/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows react-pdf to work correctly
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
