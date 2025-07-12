const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web-specific configuration for Expo SDK 53
config.resolver = {
  ...config.resolver,
  // Enable unstable package exports (default in SDK 53)
  unstable_enablePackageExports: true,
  // Add web extensions
  sourceExts: [...config.resolver.sourceExts, 'mjs'],
};

// Ensure proper MIME types for web
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Fix MIME type for JavaScript files
      if (req.url.includes('.bundle') && req.url.includes('platform=web')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;