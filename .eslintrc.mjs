// .eslintrc.mjs
export default {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:astro/recommended",
    "prettier", // <-- ¡IMPORTANTE! Debe ser el último para desactivar reglas conflictivas.
  ],
  overrides: [
    {
      files: ["*.astro"],
      parser: "astro-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
      },
      rules: {
        // Deshabilitar temporalmente la regla no-explicit-any
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
    {
      // Habilitar reglas de eslint-plugin-typescript-eslint para archivos .ts y .tsx
      files: ["**/*.ts", "**/*.tsx"],
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
      ],
      parserOptions: {
        project: ["./tsconfig.json"],
      },
      rules: {
        // Deshabilitar temporalmente la regla no-explicit-any
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};