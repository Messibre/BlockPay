import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Comprehensive plugin to fix CommonJS import issues (lodash, bech32, etc.)
function fixCommonJSImports() {
  return {
    name: "fix-commonjs-imports",
    enforce: "pre",
    resolveId(id, importer) {
      // Intercept lodash submodule imports and redirect to lodash-es
      if (id === "lodash/isEqual.js" || id === "lodash/isEqual") {
        return {
          id: "lodash-es/isEqual",
          external: false,
        };
      }
      if (id === "lodash/transform.js" || id === "lodash/transform") {
        return {
          id: "lodash-es/transform",
          external: false,
        };
      }
      // Also handle other lodash submodule imports
      if (id.startsWith("lodash/") && !id.startsWith("lodash-es/")) {
        const submodule = id.replace("lodash/", "").replace(/\.js$/, "");
        return {
          id: `lodash-es/${submodule}`,
          external: false,
        };
      }
      return null;
    },
    transform(code, id) {
      const originalCode = code;

      // Fix lodash imports
      if (code.includes("lodash/isEqual")) {
        // Replace default import with proper import from lodash-es
        code = code.replace(
          /import\s+isEqual\s+from\s+['"]lodash\/isEqual\.js['"]/g,
          "import isEqual from 'lodash-es/isEqual'"
        );
        // Also handle without .js extension
        code = code.replace(
          /import\s+isEqual\s+from\s+['"]lodash\/isEqual['"]/g,
          "import isEqual from 'lodash-es/isEqual'"
        );
      }

      // Fix lodash/transform.js imports
      if (code.includes("lodash/transform")) {
        code = code.replace(
          /import\s+(\w+)\s+from\s+['"]lodash\/transform\.js['"]/g,
          "import $1 from 'lodash-es/transform'"
        );
        code = code.replace(
          /import\s+(\w+)\s+from\s+['"]lodash\/transform['"]/g,
          "import $1 from 'lodash-es/transform'"
        );
      }

      // Note: bech32 and other CommonJS modules are handled by Vite's CommonJS plugin
      // with requireReturnsDefault: "namespace" in build.commonjsOptions
      // The pre-bundling in optimizeDeps.include ensures they're converted to ESM properly

      if (code !== originalCode) {
        return {
          code,
          map: null,
        };
      }
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    fixCommonJSImports(),
    nodePolyfills({
      // Include all necessary Node.js polyfills for Mesh SDK
      include: [
        "buffer",
        "process",
        "crypto",
        "stream",
        "util",
        "assert",
        "url",
        "os",
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    // Force pre-bundling of CommonJS modules to convert them to ESM
    // This is the key to fixing CommonJS import issues!
    include: [
      // Mesh SDK and its dependencies - include them for proper pre-bundling
      "@meshsdk/core",
      "@meshsdk/react",
      // Lodash ES modules
      "lodash-es",
      "lodash-es/isEqual",
      "lodash-es/transform",
      // CommonJS packages that need conversion
      "bech32",
      "serialize-error",
      "libsodium-wrappers-sumo",
      "libsodium-sumo",
    ],
    esbuildOptions: {
      // Handle CommonJS modules - convert to ESM during pre-bundling
      mainFields: ["module", "main"],
      // Ensure CommonJS modules are properly transformed
      format: "esm",
      // Target modern JavaScript
      target: "esnext",
    },
    // Force re-optimization when dependencies change
    force: false,
  },
  resolve: {
    // Alias lodash to lodash-es for ES module compatibility
    alias: [
      // Redirect lodash/isEqual.js to lodash-es/isEqual
      {
        find: /^lodash\/isEqual\.js$/,
        replacement: "lodash-es/isEqual",
      },
      {
        find: /^lodash\/isEqual$/,
        replacement: "lodash-es/isEqual",
      },
      // Handle other lodash submodule imports (including .js extensions)
      {
        find: /^lodash\/(.+)\.js$/,
        replacement: "lodash-es/$1",
      },
      {
        find: /^lodash\/(.+)$/,
        replacement: "lodash-es/$1",
      },
      // Handle main lodash import (if needed)
      {
        find: /^lodash$/,
        replacement: "lodash-es",
      },
    ],
    // Handle CommonJS modules like lodash
    dedupe: ["lodash", "lodash-es"],
  },
  build: {
    // Target modern browsers that support ES modules
    target: "esnext",
    commonjsOptions: {
      // Transform mixed ES/CJS modules - critical for packages that mix both
      transformMixedEsModules: true,
      // Include CommonJS packages and all node_modules in CommonJS transformation
      include: [
        /lodash/,
        /bech32/,
        /serialize-error/,
        /libsodium-wrappers-sumo/,
        /libsodium-sumo/,
        /@meshsdk/,
        /node_modules/,
      ],
      // Handle default exports from CommonJS modules
      // "namespace" creates a namespace object for CommonJS modules
      // This allows named imports like "import { bech32 } from 'bech32'" to work
      requireReturnsDefault: "namespace",
      // Convert require() calls to import statements
      strictRequires: true,
    },
    // Rollup options for better CommonJS handling
    rollupOptions: {
      output: {
        // Ensure proper format
        format: "es",
      },
    },
  },
});
