/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Explicitly allow your production origin during local dev to silence
     the Cross origin request warning for /_next/* and /api/auth. */
  experimental: {
    allowedDevOrigins: ["https://lusiqueiraburger.pt", "http://localhost:3001"],
  },
};

export default nextConfig;
