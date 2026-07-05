import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  // Doğrulama build'i, çalışan dev sunucusunun .next'ini bozmasın diye ayrı dizine yazılabilir
  // (NEXT_DIST_DIR=.next-verify next build). Boşsa varsayılan .next kullanılır.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // 'standalone' çıktısı yalnızca Docker/VPS build'inde (BUILD_STANDALONE=1) açılır.
  // Lokal `next start` standalone ile çakıştığı için lokalde kapalı kalır.
  ...(process.env.BUILD_STANDALONE ? { output: 'standalone' } : {}),
};

export default nextConfig;
