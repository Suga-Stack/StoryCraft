/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  env: {
    node: true,
    browser: true,
    es2021: true
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-empty': 'warn',
    'no-undef': 'warn',
    'no-constant-condition': 'warn',
    'no-inner-declarations': 'off',
    'no-useless-escape': 'off',
    'no-self-assign': 'warn',
    'no-prototype-builtins': 'off',
    'no-useless-catch': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/multi-word-component-names': 'off',
    'vue/no-parsing-error': 'warn',
    'vue/no-duplicate-attributes': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn'
  }
}
