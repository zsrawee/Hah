/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // No external packages needed - all data fetched via HTTP API
  },
};

const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');

module.exports = withNextIntl(nextConfig);
