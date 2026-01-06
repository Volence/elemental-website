import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker production builds
  // Skip static optimization during build when database is not available
  experimental: {
    // Increase Server Actions body size limit for image uploads (default is 1MB)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Mark Discord packages as server-only (moved from experimental in Next.js 15.x)
  serverExternalPackages: ['discord.js', '@discordjs/rest', '@discordjs/builders', '@discordjs/ws'],
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  webpack: (webpackConfig, { isServer }) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // Externalize discord.js and its optional dependencies for both server and client
    // These are server-only packages that shouldn't be bundled by webpack
    const discordExternals = {
      'discord.js': 'commonjs discord.js',
      '@discordjs/rest': 'commonjs @discordjs/rest',
      '@discordjs/builders': 'commonjs @discordjs/builders',
      '@discordjs/ws': 'commonjs @discordjs/ws',
      '@discordjs/collection': 'commonjs @discordjs/collection',
      // Optional discord.js dependencies
      'zlib-sync': 'commonjs zlib-sync',
      'erlpack': 'commonjs erlpack',
      'bufferutil': 'commonjs bufferutil',
      'utf-8-validate': 'commonjs utf-8-validate',
    }

    // Add externals for both server and client
    webpackConfig.externals = webpackConfig.externals || []
    if (Array.isArray(webpackConfig.externals)) {
      webpackConfig.externals.push(discordExternals)
    }

    // For client bundles, also add Node.js builtins to fallback
    if (!isServer) {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        // Node.js builtins
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
        worker_threads: false,
        // Discord.js packages
        'discord.js': false,
        '@discordjs/rest': false,
        '@discordjs/builders': false,
        '@discordjs/ws': false,
        '@discordjs/collection': false,
        'zlib-sync': false,
        'erlpack': false,
        'bufferutil': false,
        'utf-8-validate': false,
      }
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  // Ignore ESLint during builds to prevent warnings from failing the build
  // ESLint will still run in development, but won't block production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
