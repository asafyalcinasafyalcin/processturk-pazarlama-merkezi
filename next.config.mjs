import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  // 'standalone' çıktısı yalnızca Docker/VPS build'inde (BUILD_STANDALONE=1) açılır.
  // Lokal `next start` standalone ile çakıştığı için lokalde kapalı kalır.
  ...(process.env.BUILD_STANDALONE ? { output: 'standalone' } : {}),
};

export default nextConfig;
