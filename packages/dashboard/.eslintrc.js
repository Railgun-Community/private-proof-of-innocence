const path = require('path');

module.exports = {
  root: true,
  plugins: ['flowtype', 'simple-import-sort'],
  extends: [
    'react-app',
    'react-app/jest',
    'eslint:recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  globals: {
    React: 'readonly',
    Optional: 'readonly',
    MapType: 'readonly',
    NodeJS: 'readonly',
    Response: 'readonly',
    Buffer: 'readonly',
    JSX: 'readonly',
    Cypress: true,
  },
  rules: {
    'no-unused-vars': 0,
    'no-console': 1,
    '@typescript-eslint/no-unused-vars': 1,
    'no-shadow': 0,
    '@typescript-eslint/switch-exhaustiveness-check': 2,
    'require-await': 0,
    '@typescript-eslint/no-explicit-any': 1,
    'import/no-duplicates': 1,
    'import/no-anonymous-default-export': 0,
    'import/no-default-export': 2,
    '@typescript-eslint/no-floating-promises': 2,
    '@typescript-eslint/no-unsafe-call': 1,
    '@typescript-eslint/no-unsafe-member-access': 0,
    '@typescript-eslint/no-unsafe-argument': 0,
    'eslint-comments/no-unlimited-disable': 0,
    '@typescript-eslint/no-unsafe-assignment': 0,
    'eslint-comments/no-unused-disable': 0,
    'no-warning-comments': 1,
    '@typescript-eslint/no-non-null-assertion': 2,
    '@typescript-eslint/no-duplicate-enum-values': 1,
    'simple-import-sort/imports': [
      'warn',
      {
        groups: [
          // [0]: `@railgun` related packages.
          // [1]: `react` related packages.
          // [2]: Imports that start with a letter.
          // [3]: Imports that start with a `@` followed by a letter.
          // [4]: Imports that start with `../`
          // [5]: Imports that start with `./`
          // [6]: TS Styles imports
          // [7]: SCSS ClassNames imports
          [
            '^@railgun',
            '^react',
            `^[a-zA-Z]\\w*(?<!@|\\.\\.?\\/\\.?)$`,
            '^@?\\w',
            `^\\.+\\/`,
            `^\\.\\/`,
            'styles',
            '.scss',
          ],
        ],
      },
    ],
    'simple-import-sort/exports': 'warn',
    '@typescript-eslint/strict-boolean-expressions': 2,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    warnOnUnsupportedTypeScriptVersion: false,
    project: path.join(__dirname, 'tsconfig.json'),
  },
  overrides: [
    {
      files: ['**/__tests__/**', './src/tests/**', '**/e2e/**'],
      rules: {
        'require-await': 0,
      },
    },
  ],
  settings: {
    'import/resolver': {
      alias: {
        map: [
          // Core aliases
          ['@assets', './src/assets'],
          ['@hooks', './src/hooks/'],
          ['@models', './src/models/'],
          ['@root', './src/root/'],
          ['@services', './src/services/'],
          ['@utils', './src/utils/'],
          ['@views', './src/views/'],
          ['@scss', './src/scss/'],
          ['@react-shared', './react-shared/src'],
          // Useful aliases:
          ['@components', './src/views/components/'],
          ['@screens', './src/views/screens/'],
        ],
        extensions: ['.js', '.ts', '.tsx', '.json', '.scss'],
      },
    },
  },
};
