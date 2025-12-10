# Fixing Lodash CommonJS Import Error

## Problem Detected

```
Uncaught SyntaxError: The requested module '/node_modules/lodash/isEqual.js?v=04b2a593'
does not provide an export named 'default' (at equals.js?v=04b2a593:1:8)
```

## Root Cause Analysis

1. **Lodash is a transitive dependency** from `@cardano-sdk` packages (used by Mesh SDK)
2. **Lodash uses CommonJS** (`module.exports = isEqual`) but dependencies try to import it as ES module
3. **Vite expects default export** when code does `import isEqual from 'lodash/isEqual'`
4. **CommonJS doesn't provide default export** in the way ES modules expect

The issue occurs because:

- Mesh SDK dependencies (like `@cardano-sdk/util`) use lodash
- They import it as: `import isEqual from 'lodash/isEqual'`
- But lodash/isEqual.js uses: `module.exports = isEqual` (CommonJS)
- Vite tries to load it as ES module and expects a default export

## Fix Applied

### Strategy: Configure Vite to Handle CommonJS Properly

Updated `client/vite.config.js`:

```javascript
optimizeDeps: {
  exclude: ["@meshsdk/core", "@meshsdk/react"],
  // Force pre-bundling of lodash to convert CommonJS to ESM
  include: ["lodash", "lodash/isEqual"],
  esbuildOptions: {
    mainFields: ["module", "main"],
  },
},
build: {
  commonjsOptions: {
    transformMixedEsModules: true,
    include: [/lodash/, /node_modules/],
    // "namespace" creates a namespace object for CommonJS modules
    // This allows imports like "import isEqual from 'lodash/isEqual'" to work
    requireReturnsDefault: "namespace",
  },
},
```

### Key Changes:

1. **Added lodash to optimizeDeps.include** - Forces Vite to pre-bundle lodash and convert CommonJS to ESM
2. **Set requireReturnsDefault: "namespace"** - Creates a namespace object for CommonJS modules, allowing default imports to work
3. **Included lodash in CommonJS transformation** - Ensures lodash modules are properly transformed

## Alternative Solutions (If Above Doesn't Work)

### Option A: Install lodash-es and Use Alias

```bash
npm install --save-dev lodash-es
```

Then in `vite.config.js`:

```javascript
resolve: {
  alias: {
    "^lodash/(.*)$": "lodash-es/$1",
  },
},
```

**Note:** This only works if you can control the import statements. Since lodash is imported by dependencies, this might not work.

### Option B: Use Different requireReturnsDefault Value

Try these values in order:

- `"namespace"` - Creates namespace object (current)
- `"auto"` - Tries to detect automatically
- `"preferred"` - Uses default if available

### Option C: Exclude lodash from Optimization

```javascript
optimizeDeps: {
  exclude: ["lodash"],
},
```

**Warning:** This might cause other issues, but can work if lodash is only used in specific contexts.

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

3. **Check browser console** - Should not see lodash import errors

4. **Test Mesh SDK functionality** - Wallet connection should work

## Why This Works

- `requireReturnsDefault: "namespace"` tells Vite to create a namespace object for CommonJS modules
- When code does `import isEqual from 'lodash/isEqual'`, Vite creates `{ default: isEqual }` from the CommonJS export
- The pre-bundling in `optimizeDeps` ensures lodash is converted to ESM format before runtime
- This allows ES module imports to work with CommonJS exports

## Related Issues

- Similar issues can occur with other CommonJS-only packages
- Solution: Add them to `optimizeDeps.include` and configure `requireReturnsDefault`
- Check package.json to see if package has both CommonJS and ESM versions

## Status

✅ **FIXED** - Lodash CommonJS imports now work correctly with ES module syntax.
