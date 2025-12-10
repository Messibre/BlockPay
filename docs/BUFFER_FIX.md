# Fixing "Buffer is not defined" Error

## Problem

Mesh SDK tries to use `Buffer` but it's not available in the global scope when needed.

Error:
```
Uncaught ReferenceError: Buffer is not defined
```

## Solution

### Critical: Import Order Matters!

Polyfills **must** be set up **before** importing Mesh SDK.

### Step 1: Update main.jsx

The polyfills must be at the very top, before any Mesh SDK imports:

```javascript
// IMPORTANT: Polyfills must be set up BEFORE importing Mesh SDK
import { Buffer } from "buffer";
import process from "process";

// Set up global polyfills immediately
if (typeof global === 'undefined') {
  window.global = window;
}

// Set Buffer globally before any other imports
if (typeof Buffer !== 'undefined') {
  window.Buffer = Buffer;
  global.Buffer = Buffer;
}

// Set up process before any other imports
if (!window.process) {
  window.process = process;
  global.process = process;
}
if (!window.process.env) {
  window.process.env = {};
}
if (!window.process.nextTick) {
  window.process.nextTick = (fn) => setTimeout(fn, 0);
}
if (!window.process.browser) {
  window.process.browser = true;
}

// NOW import React and Mesh SDK
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "react-query";
import { MeshProvider } from "@meshsdk/react";
// ... rest of imports
```

### Step 2: Update index.html (Optional but Recommended)

Add a script tag to set up `global` before any modules load:

```html
<head>
  <script>
    // Polyfill globals before any modules load
    if (typeof global === 'undefined') {
      window.global = window;
    }
  </script>
</head>
```

### Step 3: Update vite.config.js

Add esbuild define to ensure global is available:

```javascript
esbuild: {
  define: {
    global: "globalThis",
  },
}
```

## Why This Happens

- Mesh SDK uses `Buffer` internally
- If Buffer isn't in global scope when Mesh SDK loads, it fails
- Import order matters - polyfills must come first
- ES modules load synchronously, so order is critical

## Verification

After fixing, check in browser console:

```javascript
console.log(window.Buffer); // Should be defined
console.log(global.Buffer); // Should be defined
console.log(Buffer); // Should work in modules
```

## Common Issues

**Still getting "Buffer is not defined"?**
1. Check import order - Buffer must be imported before Mesh SDK
2. Clear browser cache (Ctrl+Shift+R)
3. Restart dev server completely
4. Verify `buffer` package is installed: `pnpm list buffer`
5. Check that `window.Buffer` exists in console before Mesh SDK loads

**Buffer works in console but not in code?**
- This means it's a scope issue
- Make sure both `window.Buffer` and `global.Buffer` are set
- Verify import order in main.jsx

## Alternative: Use vite-plugin-node-polyfills

If manual polyfills continue to cause issues:

```bash
pnpm add -D vite-plugin-node-polyfills
```

Update `vite.config.js`:

```javascript
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  // Remove manual polyfills from main.jsx if using this
});
```

