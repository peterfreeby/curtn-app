import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  serverExternalPackages: ['mongoose', 'bcrypt', 'mongodb', 'bson', 'firebase-admin'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['server'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const nativeModules = /^(bcrypt|mongodb|mongoose|bson|firebase-admin)($|\/)/

      const prevExternals = config.externals
      config.externals = async (ctx: any) => {
        const { request } = ctx
        if (request && nativeModules.test(request)) {
          return `commonjs ${request}`
        }

        if (Array.isArray(prevExternals)) {
          for (const ext of prevExternals) {
            if (typeof ext === 'function') {
              const result = await ext(ctx)
              if (result) return result
            } else if (typeof ext === 'string' && ext === request) {
              return `commonjs ${request}`
            } else if (ext instanceof RegExp && request && ext.test(request)) {
              return `commonjs ${request}`
            }
          }
        } else if (typeof prevExternals === 'function') {
          return prevExternals(ctx)
        }
        return undefined
      }
    }
    return config
  },
}

export default nextConfig
