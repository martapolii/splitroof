export default {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.jsx?$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic" }],
        ],
      },
    ],
  },
  // CSS imports don't matter in tests
  moduleNameMapper: { "\\.css$": "identity-obj-proxy" },
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
};
