// Node-only tests. The sync-layer tests run the real @meteorrn/core source
// against a fake DDP server over real sockets (`ws`).
module.exports = {
  testEnvironment: '<rootDir>/jest.environment.js',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts?(x)'],
  // The app's babel.config.js adds NativeWind and worklets, which pull their
  // React Native runtimes into every file; Node tests need neither.
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      { configFile: false, babelrc: false, presets: ['babel-preset-expo'] },
    ],
  },
  // @meteorrn/core ships untranspiled ESM with extension-less imports.
  transformIgnorePatterns: ['/node_modules/(?!@meteorrn/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // The library probes for react-native at load and falls back to plain
    // timers without it; force the fallback instead of loading RN under Node.
    '^\\.\\./helpers/reactNativeBindings\\.js$':
      '<rootDir>/src/sync/__tests__/support/reactNativeBindings.js',
  },
}
