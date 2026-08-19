const js = require('@eslint/js');
const globals = require('globals');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

const tsRecommended = tsPlugin.configs['flat/recommended'].map((config) => ({
  ...config,
  files: ['**/*.ts'],
}));

module.exports = [
  {
    ignores: ['dist/**'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,ts}'],
  },
  ...tsRecommended,
  prettierRecommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 0,
      'no-inner-declarations': 0,
      'arrow-parens': ['error', 'always'],
      semi: ['error', 'always'],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-empty-interface': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/no-this-alias': 0,
      '@typescript-eslint/ban-ts-comment': 0,
      '@typescript-eslint/no-namespace': 0,
      '@typescript-eslint/no-empty-function': 0,
    },
  },
];
