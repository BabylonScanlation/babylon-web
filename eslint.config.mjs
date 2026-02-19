import pluginJs from '@eslint/js';
import astroParser from 'astro-eslint-parser';
import prettier from 'eslint-config-prettier';
import pluginAstro from 'eslint-plugin-astro';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules', 'dist', '.astro', '.wrangler', 'dist-workers'],
  },
  pluginJs.configs.recommended, // General JS recommended rules
  ...tseslint.configs.recommended, // General TS recommended rules
  ...eslintPluginSvelte.configs['flat/recommended'], // Recommended Svelte rules

  // Configuration for .ts and .tsx files (type-aware)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked.rules,
      // Deshabilitar temporalmente la regla no-explicit-any
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Configuration for .svelte files
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        project: true, // Enable type-aware linting if desired, or remove to match .astro strategy
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Add or override specific Svelte rules here
      'svelte/no-at-html-tags': 'warn',
    },
  },

  // Configuration for .astro files
  ...pluginAstro.configs.recommended, // Recommended Astro rules
  // ...pluginAstro.configs['jsx-a11y-recommended'], // If you want jsx-a11y rules for Astro

  // Override/add specific rules for .astro files if needed,
  // especially for TypeScript parsing within Astro components
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.astro'],
        // project: './tsconfig.eslint.json', // Disable type-aware linting for TS in Astro files
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Manually add rules from recommended Astro configs
      ...pluginAstro.configs.recommended.rules,
      // ...pluginAstro.configs['jsx-a11y-recommended'].rules, // Add this if needed
      // Deshabilitar temporalmente @typescript-eslint/no-unused-vars
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      // Deshabilitar temporalmente la regla no-explicit-any
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier, // Prettier config
  {
    files: ['scripts/**/*.js', 'scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ['dist-workers/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        ImageData: 'readonly',
      },
    },
  },
  {
    files: ['*.cjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['src/layouts/Layout.astro'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];
