import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Windows NTFS unprivileged compatibility shim for standalone trace copying
if (process.platform === 'win32') {
  const origSymlink = fs.promises.symlink;
  fs.promises.symlink = async function (target, dest, type) {
    try {
      return await origSymlink.call(this, target, dest, type);
    } catch (err) {
      if (err.code === 'EPERM') {
        try {
          const resolvedTarget = path.isAbsolute(target)
            ? target
            : path.resolve(path.dirname(dest), target);
          const real = fs.existsSync(resolvedTarget)
            ? fs.realpathSync(resolvedTarget)
            : resolvedTarget;
          const stat = fs.statSync(real);
          if (stat.isDirectory()) {
            return await origSymlink.call(this, real, dest, 'junction');
          } else {
            return await fs.promises.copyFile(real, dest);
          }
        } catch {
          // Fallback handled
        }
        return;
      }
      throw err;
    }
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: {
    // Type-checking is handled via dedicated `pnpm tsc --noEmit`
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
    };
    return config;
  },
};

export default nextConfig;
