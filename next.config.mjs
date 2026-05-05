/** @type {import('next').NextConfig} */
//
// OPENCAP_BUILD_TARGET=electron is set by the desktop build pipeline. The
// SQLite Prisma client legitimately loses the enum literal-union types
// (since SQLite has no enums), so we skip Next's strict typecheck for that
// path. The Postgres build remains the canonical type-safety gate.
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  typescript: {
    ignoreBuildErrors: process.env.OPENCAP_BUILD_TARGET === "electron",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
