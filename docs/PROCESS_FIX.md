# Fixing "Cannot read properties of undefined" Process Error

## Problem

The `process` polyfill is missing required properties that Node.js libraries expect, causing:
```
Cannot read properties of undefined (reading 'slice')
```

This happens because `readable-stream` and other libraries expect `process` to have specific properties.

## Solution

### Step 1: Ensure process package is installed

```bash
cd frontend
pnpm add process
# or
npm install process
```

### Step 2: Update main.jsx

Add complete process polyfill with all required properties:

```javascript
import process from "process";

// Ensure process has all required properties
if (!window.process) {
  window.process = process;
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
```

### Step 3: Update vite.config.js

Ensure process.env is properly defined:

```javascript
define: {
  global: "globalThis",
  "process.env": "{}",
  "process.browser": "true",
}
```

## Why This Happens

Node.js libraries like `readable-stream` expect:
- `process.env` - environment variables
- `process.nextTick` - async callback function
- `process.browser` - flag indicating browser environment
- Other process properties

The basic `process` package might not include all of these.

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
      buffer: true,
      process: true,
    }),
  ],
  // ... rest of config
});
```

## Verification

After fixing, check in browser console:

```javascript
console.log(window.process); // Should exist
console.log(window.process.env); // Should be {}
console.log(window.process.nextTick); // Should be function
console.log(window.process.browser); // Should be true
```

## Common Issues

**Still getting errors?**
- Clear browser cache (Ctrl+Shift+R)
- Restart dev server completely
- Check that `process` package is installed
- Verify all process properties exist

**Property errors?**
- Make sure `process.env` is an object (not undefined)
- Ensure `process.nextTick` is defined
- Check that `process.browser` is set to `true`

