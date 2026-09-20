import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const relaxedNextVitals = nextVitals.map((config) => {
  if (!config.plugins?.["react-hooks"]) return config;

  return {
    ...config,
    rules: {
      ...config.rules,
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  };
});

const relaxedNextTs = nextTs.map((config) => {
  if (!config.rules?.["@typescript-eslint/no-explicit-any"]) return config;

  return {
    ...config,
    rules: {
      ...config.rules,
      "@typescript-eslint/no-explicit-any": "warn",
    },
  };
});

const eslintConfig = defineConfig([
  ...relaxedNextVitals,
  ...relaxedNextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
