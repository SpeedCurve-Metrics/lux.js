module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  globals: {
    page: true,
    browser: true,
    context: true,
    requestInterceptor: true,
    navigateTo: true,
  },
};
