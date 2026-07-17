const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Alias react-native-reanimated to a local shim during development (Expo Go)
// to avoid native TurboModule initialization errors when the native module
// is not available in the runtime. In production builds the real package
// will be resolved instead.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = Object.assign({}, config.resolver.extraNodeModules, {
  'react-native-reanimated': path.resolve(__dirname, 'app', 'shims', 'reanimated'),
  'react-native-worklets': path.resolve(__dirname, 'app', 'shims', 'worklets'),
  'moti': path.resolve(__dirname, 'app', 'shims', 'moti'),
});

// Ensure Metro resolves TS/TSX extensions
config.resolver.sourceExts = Array.from(new Set([...(config.resolver.sourceExts || []), 'ts', 'tsx']));

module.exports = config;
