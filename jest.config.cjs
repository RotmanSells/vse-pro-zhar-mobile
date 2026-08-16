/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'mjs'],
  roots: ['<rootDir>'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/apps/**/*.test.ts',
    '<rootDir>/apps/**/*.test.tsx',
    '<rootDir>/apps/**/*.spec.ts',
    '<rootDir>/apps/**/*.spec.tsx',
    '<rootDir>/packages/**/*.test.ts',
    '<rootDir>/packages/**/*.test.tsx',
    '<rootDir>/packages/**/*.spec.ts',
    '<rootDir>/packages/**/*.spec.tsx',
  ],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
