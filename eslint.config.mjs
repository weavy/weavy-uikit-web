import tanstackQuery from "@tanstack/eslint-plugin-query";
import * as lit from "eslint-plugin-lit";
import { defineConfig, globalIgnores } from "eslint/config";

import * as wc from "eslint-plugin-wc";
import globals from "globals";
import ts_eslint from "typescript-eslint";

import eslint from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import { rules as litA11yRules, configs as litA11yConfigs } from "eslint-plugin-lit-a11y";

export default defineConfig([
  globalIgnores(["**/dist/"]),
  eslint.configs.recommended,
  ...ts_eslint.configs.recommendedTypeChecked,
  wc.configs["flat/recommended"],
  lit.configs["flat/recommended"],
  ...tanstackQuery.configs["flat/recommended"],
  {
    plugins: {
      "lit-a11y": {
        rules: fixupPluginRules(litA11yRules),
      },
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        WEAVY_SOURCE_NAME: "readonly",
        WEAVY_VERSION: "readonly",
      },
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      ...litA11yConfigs.recommended.rules,
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
            inheritedMethods: false
          }
        }
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
  },
  {
    files: ["lib/**/*.cjs", "utils/**/*.{mj,cj,j,t}s"],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["tests/**/*.ts"],

    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
]);
