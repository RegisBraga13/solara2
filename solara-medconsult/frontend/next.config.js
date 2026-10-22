/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite ter duas especialidades compiladas lado a lado (ex.: NEXT_DIST_DIR=.next-psiquiatria).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

module.exports = nextConfig;
