module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["@typescript-eslint", "prettier"],
  env: {
    browser: true,
  },
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
  },
};
