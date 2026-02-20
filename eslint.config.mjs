import tanstackQuery from "@tanstack/eslint-plugin-query";
import * as lit from "eslint-plugin-lit";
import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import * as wc from "eslint-plugin-wc";
import globals from "globals";
import ts_eslint from "typescript-eslint";
import litA11y from "eslint-plugin-lit-a11y";

export default defineConfig([
  globalIgnores(["**/dist/"]),
  eslint.configs.recommended,
  ...ts_eslint.configs.recommendedTypeChecked,
  wc.configs["flat/recommended"],
  lit.configs["flat/recommended"],
  ...tanstackQuery.configs["flat/recommended"],
  litA11y.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        WEAVY_SOURCE_NAME: "readonly",
        WEAVY_SOURCE_FORMAT: "readonly",
        WEAVY_VERSION: "readonly",
      },
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "dev/*.mjs", "dev/*.ts", "utils/*.js", "*.ts"],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      "@typescript-eslint/no-unsafe-argument": "warn",
      "no-prototype-builtins": "off",
      "no-console": ["warn", { allow: ["info", "warn", "error"] }],
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/unbound-method": "warn",
      "@typescript-eslint/no-for-in-array": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",

      "@typescript-eslint/no-empty-object-type": [
        "error",
        {
          allowInterfaces: "always",
        },
      ],

      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          allowShortCircuit: true,
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            inheritedMethods: false,
          },
        },
      ],

      "@tanstack/query/exhaustive-deps": "warn",
      "lit-a11y/no-autofocus": "warn",
      "lit-a11y/click-events-have-key-events": "warn",
      "lit-a11y/anchor-is-valid": "warn",
    },
  },
  {
    files: ["cli/**/*.[mc]js", "dev/**/*.{mj,cj,j,t}s"],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "warn",
    },
  },
  {
    files: ["lib/**/*.cjs", "utils/**/*.{mj,cj,j,t}s"],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "warn",
    },
  },
  {
    files: ["tests/**/*.ts"],

    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
]);
