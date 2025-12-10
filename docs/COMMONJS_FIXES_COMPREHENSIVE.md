# Comprehensive CommonJS Import Fixes

## Overview

This document summarizes all CommonJS import errors that have been fixed in the Cardano frontend application. These errors occur when CommonJS modules are imported as ES modules, which is common with older npm packages and transitive dependencies.

## Fixed Packages

### 1. ✅ lodash / lodash-es

- **Error**: `does not provide an export named 'default'`
- **Location**: `lodash/isEqual.js`, `lodash/transform.js`
- **Solution**:
  - Installed `lodash-es` (ES module version)
  - Added resolve aliases to redirect `lodash/*` → `lodash-es/*`
  - Added to `optimizeDeps.include` and `build.commonjsOptions.include`
- **Documentation**: `docs/LODASH_FIX.md`

### 2. ✅ bech32

- **Error**: `does not provide an export named 'bech32'`
- **Location**: `@cardano-sdk/util/dist/esm/primitives.js`
- **Solution**:
  - Added `bech32` to `optimizeDeps.include`
  - Added `/bech32/` to `build.commonjsOptions.include`
  - Set `requireReturnsDefault: "namespace"`
- **Documentation**: `docs/BECH32_COMMONJS_FIX.md`

### 3. ✅ serialize-error

- **Error**: `does not provide an export named 'serializeError'`
- **Location**: `@cardano-sdk/util/dist/esm/serializableObject.js`
- **Solution**:
  - Added `serialize-error` to `optimizeDeps.include`
  - Added `/serialize-error/` to `build.commonjsOptions.include`
  - Set `requireReturnsDefault: "namespace"`
- **Documentation**: `docs/BECH32_COMMONJS_FIX.md` (updated)

### 4. ✅ libsodium-wrappers-sumo

- **Error**: `does not provide an export named 'default'`
- **Location**: `@cardano-sdk/crypto/dist/esm/Bip32/Bip32KeyDerivation.js`
- **Solution**:
  - Added `libsodium-wrappers-sumo` and `libsodium-sumo` to `optimizeDeps.include`
  - Added `/libsodium-wrappers-sumo/` and `/libsodium-sumo/` to `build.commonjsOptions.include`
  - Set `requireReturnsDefault: "namespace"`
- **Documentation**: `docs/LIBSODIUM_COMMONJS_FIX.md`

## Configuration Pattern

All fixes follow the same pattern in `client/vite.config.js`:

### 1. Pre-bundling (Dev Mode)

```javascript
optimizeDeps: {
  include: [
    "package-name", // Force pre-bundling to convert CommonJS to ESM
  ],
}
```

### 2. Build Transformation

```javascript
build: {
  commonjsOptions: {
    include: [/package-name/, /node_modules/],
    requireReturnsDefault: "namespace", // Critical for named/default imports
  },
}
```

### 3. Special Cases (lodash)

For packages with ES module alternatives:

```javascript
resolve: {
  alias: [
    { find: /^lodash\/(.+)$/, replacement: "lodash-es/$1" },
  ],
}
```

## Why This Works

1. **Pre-bundling**: `optimizeDeps.include` forces Vite to pre-bundle CommonJS modules using esbuild, converting them to ESM format during development.

2. **Namespace Object**: `requireReturnsDefault: "namespace"` creates a namespace object for CommonJS modules:

   - CommonJS: `module.exports = { bech32: ... }`
   - ES Module: `import { bech32 } from 'bech32'` ✅ Works!

3. **Build Transformation**: `build.commonjsOptions.include` ensures CommonJS modules are properly transformed during production builds.

## How to Fix Future CommonJS Errors

When you encounter a new CommonJS import error:

1. **Identify the package** from the error message
2. **Add to `optimizeDeps.include`**:
   ```javascript
   optimizeDeps: {
     include: ["problematic-package"],
   }
   ```
3. **Add to `build.commonjsOptions.include`**:
   ```javascript
   build: {
     commonjsOptions: {
       include: [/problematic-package/, /node_modules/],
       requireReturnsDefault: "namespace",
     },
   }
   ```
4. **Clear Vite cache**: `Remove-Item -Recurse -Force node_modules\.vite`
5. **Restart dev server**: `npm run dev`

## Error Patterns to Watch For

- `does not provide an export named 'default'` → CommonJS default export issue
- `does not provide an export named 'X'` → CommonJS named export issue
- `The requested module '...' does not provide an export` → CommonJS/ESM mismatch

## Current Configuration

See `client/vite.config.js` for the complete configuration with all fixes applied.

## Status

✅ **All Known CommonJS Import Errors Fixed**

- lodash/isEqual ✅
- lodash/transform ✅
- bech32 ✅
- serialize-error ✅
- libsodium-wrappers-sumo ✅
- libsodium-sumo ✅

## Testing

After applying fixes:

1. Clear Vite cache
2. Restart dev server
3. Check browser console for errors
4. Test Mesh SDK functionality (wallet connection, transactions, etc.)
