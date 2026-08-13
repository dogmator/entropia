import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const MAX_COMPLEXITY = 10;
const MAX_LINES_PER_FUNCTION = 50;
const MAX_DEPTH = 3;
const MAX_PARAMS = 3;
const MAX_COGNITIVE_COMPLEXITY = 15;
const DUPLICATE_STRING_THRESHOLD = 5;

// eslint-disable-next-line sonarjs/deprecation, @typescript-eslint/no-deprecated -- requires migration to tseslint.defineConfig
export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      sonarjs.configs.recommended,
      prettier,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit', overrides: { constructors: 'no-public' } }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-shadow': 'error',

      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'should', 'can'],
        },
        {
          selector: 'function',
          filter: { regex: '^handle', match: true },
          format: ['camelCase'],
        },
      ],

      '@typescript-eslint/explicit-module-boundary-types': 'error',

      'complexity': ['error', { max: MAX_COMPLEXITY }],
      'max-lines-per-function': ['error', { max: MAX_LINES_PER_FUNCTION, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', MAX_DEPTH],
      'max-params': ['error', MAX_PARAMS],

      'sonarjs/no-duplicate-string': ['error', { threshold: DUPLICATE_STRING_THRESHOLD }],
      'sonarjs/cognitive-complexity': ['error', MAX_COGNITIVE_COMPLEXITY],
      'sonarjs/no-identical-functions': 'error',

      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1],
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true
        }
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSTypeReference > Identifier[name="any"]',
          message: 'Avoid using "as any". Use proper types or "unknown" if necessary.',
        },
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: 'Avoid using "as any". Use proper types or "unknown" if necessary.',
        },
      ],
      'react/no-unknown-property': ['error', { ignore: ['args', 'attach', 'position', 'rotation', 'scale', 'intensity', 'groundColor', 'object', 'geometry', 'material', 'castShadow', 'receiveShadow', 'decay', 'penumbra', 'angle', 'target', 'transparent', 'opacity', 'side', 'map', 'emissive', 'emissiveIntensity', 'shininess', 'specular', 'frustumCulled', 'onPointerMissed', 'depthWrite', 'flatShading'] }],
    },
  }
);
