module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^canonicalize$': '<rootDir>/node_modules/canonicalize/lib/canonicalize.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
