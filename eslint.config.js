import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"],
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.node
      } 
    },
    rules: {
      "no-unused-vars": "warn",    // Warn if you declare vars and never use them
      "no-console": "off",         // Allow console.log (useful for debugging)
      "eqeqeq": "error",           // Force === instead of ==
    }
  }
]);
