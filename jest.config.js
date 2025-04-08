// jest.config.js
module.exports = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    transform: {},
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testTimeout: 30000,  // Default timeout for all tests
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    moduleDirectories: ['node_modules'],
    testPathIgnorePatterns: ['/node_modules/']
  };