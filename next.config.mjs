import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy traced dependencies when Windows does not permit symlinks. Avoid junctions:
// build cleanup must never traverse into the source dependency tree.
if (process.platform === 'win32') {
  const origSymlink = fs.promises.symlink;
  fs.promises.symlink = async function (target, dest, type) {
    try {
      return await origSymlink.call(this, target, dest, type);
    } catch (err) {
      if (err.code !== 'EPERM') throw err;
      const resolvedTarget = path.isAbsolute(target)
        ? target
        : path.resolve(path.dirname(dest), target);
      await fs.promises.cp(resolvedTarget, dest, { recursive: true, dereference: true });
    }
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // Production audit artifacts must not trigger continuous dev recompilation.
    const ignored = config.watchOptions?.ignored;
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ignored instanceof RegExp
        ? new RegExp(`(?:${ignored.source})|(?:[\\\\/]\\.next-audit(?:[\\\\/]|$))`, ignored.flags)
        : [...(Array.isArray(ignored) ? ignored : typeof ignored === 'string' ? [ignored] : []), '**/.next-audit/**'],
    };
    if (config.cache && typeof config.cache === 'object') {
      config.cache.buildDependencies = {
        ...config.cache.buildDependencies,
        config: [
          ...(config.cache.buildDependencies?.config || []),
          path.resolve(__dirname, 'postcss.config.mjs'),
          path.resolve(__dirname, 'tailwind.config.ts'),
        ],
      };
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests'),
    };
    return config;
  },
};

export default nextConfig;
