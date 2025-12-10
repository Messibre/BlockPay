# Fixing bech32 and CommonJS Import Errors

## Problem Detected

```
Uncaught SyntaxError: The requested module '/node_modules/bech32/dist/index.js?v=72393a46'
does not provide an export named 'bech32' (at primitives.js?v=72393a46:1:10)
```

## Root Cause Analysis

1. **bech32 is a CommonJS module** - It uses `exports.bech32 = ...` (CommonJS syntax)
2. **Code imports it as ES module** - `@cardano-sdk/util/dist/esm/primitives.js` does: `import { bech32 } from 'bech32'`
3. **Vite expects named ES exports** - But CommonJS `exports.bech32` doesn't work directly with ES module named imports
4. **Similar to lodash issue** - This is the same pattern as the lodash/isEqual problem

## Fix Applied

### Strategy: Pre-bundle and Configure CommonJS Handling

Updated `client/vite.config.js`:

1. **Added bech32 to optimizeDeps.include** - Forces Vite to pre-bundle bech32 and convert CommonJS to ESM during dev
2. **Added bech32 to build.commonjsOptions.include** - Ensures bech32 is transformed during build
3. **Set requireReturnsDefault: "namespace"** - Creates a namespace object for CommonJS modules, allowing named imports

```javascript
optimizeDeps: {
  include: [
    "lodash-es",
    "lodash-es/isEqual",
    "bech32", // Pre-bundle bech32 to handle CommonJS exports
  ],
},
build: {
  commonjsOptions: {
    include: [/lodash/, /bech32/, /node_modules/],
    requireReturnsDefault: "namespace", // Allows "import { bech32 } from 'bech32'"
  },
},
```

## How This Works

- **Pre-bundling (dev mode)**: `optimizeDeps.include` tells Vite to pre-bundle bech32 using esbuild, which converts CommonJS to ESM
- **Build mode**: `commonjsOptions.requireReturnsDefault: "namespace"` creates a namespace object, so `import { bech32 }` works with CommonJS `exports.bech32`
- **Namespace object**: When set to "namespace", CommonJS `exports.bech32` becomes accessible as `{ bech32 }` in ES module imports

## Preventing Similar Issues

### Pattern to Watch For

If you see errors like:

- `does not provide an export named 'X'`
- `The requested module '...' does not provide an export named 'default'`
- CommonJS modules being imported as ES modules

### Solution Template

1. **Add to optimizeDeps.include** (for dev mode):

   ```javascript
   optimizeDeps: {
     include: ["problematic-package"],
   },
   ```

2. **Add to build.commonjsOptions.include** (for build mode):

   ```javascript
   build: {
     commonjsOptions: {
       include: [/problematic-package/, /node_modules/],
       requireReturnsDefault: "namespace",
     },
   },
   ```

3. **If package has ES module version** (like lodash → lodash-es):
   - Install ES module version: `npm install --save-dev package-es`
   - Add resolve alias to redirect imports
   - Update optimizeDeps to use ES module version

### Common Packages That Need This Fix

- `bech32` - CommonJS, used by Cardano SDK ✅ Fixed
- `serialize-error` - CommonJS, used by Cardano SDK ✅ Fixed
- `libsodium-wrappers-sumo` - CommonJS, used by Cardano SDK ✅ Fixed
- `libsodium-sumo` - CommonJS dependency ✅ Fixed
- `lodash` - CommonJS (use `lodash-es` instead) ✅ Fixed
- `lodash/transform.js` - CommonJS submodule ✅ Fixed
- `crypto` - Node.js built-in (use polyfills) ✅ Fixed
- Other older npm packages that haven't migrated to ESM

## Verification

After applying the fix:

1. **Clear Vite cache:**

   ```bash
   rm -rf node_modules/.vite
   # or on Windows:
   Remove-Item -Recurse -Force node_modules\.vite
   ```

2. **Restart dev server:**

   ```bash
   npm run dev
   ```

3. **Check browser console** - Should not see bech32 import errors

4. **Test build:**
   ```bash
   npm run build
   ```

## Status

✅ **FIXED** - bech32 CommonJS imports now work correctly with ES module syntax.

The same pattern can be applied to any other CommonJS modules that cause similar import errors.
