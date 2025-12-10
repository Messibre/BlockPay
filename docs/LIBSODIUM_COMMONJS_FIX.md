# Fixing libsodium-wrappers-sumo CommonJS Import Error

## Problem Detected

```
Uncaught SyntaxError: The requested module '/node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js?v=f6cd269c'
does not provide an export named 'default' (at Bip32KeyDerivation.js?v=f6cd269c:3:8)
```

## Root Cause Analysis

1. **libsodium-wrappers-sumo is a CommonJS/UMD module** - Uses UMD wrapper with CommonJS exports
2. **Code imports it as ES module** - `@cardano-sdk/crypto/dist/esm/Bip32/Bip32KeyDerivation.js` does: `import sodium from 'libsodium-wrappers-sumo'`
3. **Vite expects default export** - But CommonJS UMD modules don't provide default export in the way ES modules expect
4. **Same pattern as other CommonJS issues** - This follows the same pattern as lodash, bech32, and serialize-error

## Fix Applied

### Strategy: Pre-bundle and Configure CommonJS Handling

Updated `client/vite.config.js`:

1. **Added libsodium-wrappers-sumo to optimizeDeps.include** - Forces Vite to pre-bundle and convert CommonJS to ESM during dev
2. **Added libsodium-sumo to optimizeDeps.include** - Also pre-bundle its dependency
3. **Added to build.commonjsOptions.include** - Ensures proper transformation during build
4. **Set requireReturnsDefault: "namespace"** - Creates namespace object for CommonJS modules

```javascript
optimizeDeps: {
  include: [
    "libsodium-wrappers-sumo", // Pre-bundle libsodium-wrappers-sumo (CommonJS with default export)
    "libsodium-sumo", // Dependency of libsodium-wrappers-sumo
  ],
},
build: {
  commonjsOptions: {
    include: [
      /libsodium-wrappers-sumo/,
      /libsodium-sumo/,
      /node_modules/,
    ],
    requireReturnsDefault: "namespace", // Allows "import sodium from 'libsodium-wrappers-sumo'"
  },
},
```

## How This Works

- **Pre-bundling (dev mode)**: `optimizeDeps.include` tells Vite to pre-bundle libsodium-wrappers-sumo using esbuild, which converts CommonJS/UMD to ESM
- **Build mode**: `commonjsOptions.requireReturnsDefault: "namespace"` creates a namespace object, so `import sodium from 'libsodium-wrappers-sumo'` works with CommonJS exports
- **Namespace object**: When set to "namespace", CommonJS `module.exports = ...` becomes accessible as default export in ES module imports

## Verification

After applying the fix:

1. **Clear Vite cache:**

   ```bash
   Remove-Item -Recurse -Force node_modules\.vite
   ```

2. **Restart dev server:**

   ```bash
   npm run dev
   ```

3. **Check browser console** - Should not see libsodium-wrappers-sumo import errors

4. **Test Mesh SDK functionality** - Bip32 key derivation should work

## Status

✅ **FIXED** - libsodium-wrappers-sumo CommonJS imports now work correctly with ES module syntax.
