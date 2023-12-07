import type { Config } from '@jest/types';
// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  roots: [
    "./"
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: [
    '**/__tests__/**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  testPathIgnorePatterns: [
    '@types',
    'node_modules',
  ],
  coverageReporters: ["html", "lcov"],
  setupFiles: [
    "./__tests__/setup.ts",
  ]
};
export default config;