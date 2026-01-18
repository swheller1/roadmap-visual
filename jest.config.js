/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    collectCoverageFrom: [
        'src/services/**/*.ts',
        '!src/**/*.d.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    // Mock Power BI API since we're testing isolated utilities
    moduleNameMapper: {
        '^powerbi-visuals-api$': '<rootDir>/test/__mocks__/powerbi-visuals-api.ts'
    }
};
