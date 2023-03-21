module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  plugins: ["@typescript-eslint", "import", "prettier"],
  env: {
    browser: true,
  },
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
    "import/order": [
      "error",
      {
        alphabetize: { order: "asc" },
      },
    ],
  },
  overrides: [
    {
      files: ["src/*"],
      rules: {
        "no-restricted-syntax": ["error", "TemplateLiteral"],
      },
    },
  ],
};
