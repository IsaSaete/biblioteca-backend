import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["dist/**", "coverage/**"] },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: { js },
    extends: ["js/recommended"],
    rules: {
      "no-console": "error",
      "max-params": ["error", 4],
    },
  },

  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    rules: {
      // Permite nombrar explícitamente como descartada una variable
      // destructurada que no se usa (ej. separar un campo de un objeto).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
]);
