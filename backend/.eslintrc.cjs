module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["prettier", "import"],
  extends: ["eslint:recommended", "plugin:import/recommended", "plugin:prettier/recommended"],
  rules: {
    "import/order": [
      "warn",
      {
        alphabetize: { order: "asc" },
        "newlines-between": "always",
      },
    ],
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
  settings: {
    "import/resolver": {
      node: { extensions: [".js"] },
    },
  },
};

