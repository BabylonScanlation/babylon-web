// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    { ignores: ["dist/", ".wrangler/", "db_snapshots/"] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...astro.configs['flat/recommended'],
    {
      files: ['**/*.astro'],
      rules: {
        // override/add rules settings here, such as:
        // "no-unused-vars": "error"
      },
    },
    {
      // Reglas personalizadas
      rules: {
                "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
      }
    },
    prettier,
  );
  