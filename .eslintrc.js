module.exports = {
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  root: true,
  rules: {
    'no-console': 0,
    'no-inner-declarations': 0,
    'arrow-parens': ['error', 'always'],
    semi: ['error', 'always'],
  },
  env: {
    node: true,
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: ['plugin:@typescript-eslint/recommended'],
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
  ],
};