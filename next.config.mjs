/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongodb'],
  outputFileTracingIncludes: {
    '/html-library': ['./public/html-library/**/*.html'],
  },
};

export default nextConfig;
