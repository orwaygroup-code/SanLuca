/** @type {import('next').NextConfig} */
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://api.mercadopago.com https://graph.facebook.com https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy",   value: CSP },
];

/**
 * Identificador del build. Se fija aquí —en vez de dejar que Next genere uno
 * aleatorio— para que sea legible en los registros y estable dentro de un mismo
 * build. Es el valor que acaba en .next/BUILD_ID, que a su vez sella el HTML y
 * responde /api/version: comparar ambos revela una tablet corriendo código
 * viejo (ver lib/buildId.ts).
 */
const BUILD_ID = process.env.BUILD_ID || `sl-${Date.now().toString(36)}`;

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  generateBuildId: () => BUILD_ID,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

module.exports = nextConfig;
