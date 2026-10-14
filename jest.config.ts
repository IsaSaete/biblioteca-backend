import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  verbose: true,
  // La primera ejecución sin caché descarga el binario de MongoDB en memoria.
  testTimeout: 60000,
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: [
    "<rootDir>/jest-mongodb-config.cjs",
    "<rootDir>/jest.setup-env.cjs",
  ],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/server/startServer.ts",
    "!src/middleware/handleCors.ts",
    "!src/**/types.ts",
    "!src/database/connectToDatabase.ts",
    "!src/**/fixtures/**/*.ts",
    "!src/test/**/*.ts",
  ],
};

export default config;
