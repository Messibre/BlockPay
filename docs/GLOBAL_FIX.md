# Fixing Node.js Global Errors (global, process, Buffer)

## Problem

Mesh SDK uses Node.js libraries that expect Node.js globals which don't exist in browsers:
- `global` - global object
- `process` - process information
- `Buffer` - binary data handling

Errors:
```
Uncaught ReferenceError: global is not defined
Uncaught ReferenceError: process is not defined
```

## Solution

### Step 1: Install Polyfills

```bash
cd frontend
pnpm add buffer process
# or
npm install buffer process
```

### Step 2: Update vite.config.js

Added:
- `define: { global: "globalThis", "process.env": {} }` - Maps globals
- `resolve.alias` for buffer and process
- `optimizeDeps.include` for buffer and process

### Step 3: Update main.jsx

Added polyfills at the top:
```javascript
import { Buffer } from "buffer";
import process from "process";

window.global = window.global || window;
window.Buffer = window.Buffer || Buffer;
window.process = window.process || process;
```

## Why This Happens

- Mesh SDK uses Node.js crypto libraries (pbkdf2, readable-stream, etc.)
- These libraries expect Node.js globals (`global`, `process`, `Buffer`)
- Browsers don't have these by default
- We need to polyfill them

## Alternative Solutions

If the above doesn't work, try:

### Option 1: Add to index.html

```html
<script>
  window.global = window;
  if (typeof globalThis === 'undefined') {
    window.globalThis = window;
  }
</script>
```

### Option 2: Use vite-plugin-node-polyfills (Alternative)

If manual polyfills don't work, use this plugin:

```bash
pnpm add -D vite-plugin-node-polyfills
```

Then in `vite.config.js`:
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
  // ... rest of config
});
```

**Note:** The manual approach (installing `buffer` and `process` packages) is usually simpler and works better.

## Verification

After fixing:
1. Restart dev server
2. Check browser console - no "global is not defined" error
3. Wallet connection should work

## Common Issues

**Still getting errors?**
- Clear browser cache (Ctrl+Shift+R)
- Restart dev server
- Check that `buffer` package is installed
- Verify `main.jsx` has the polyfills

**Buffer errors?**
- Make sure `buffer` is in dependencies (not devDependencies)
- Check that `window.Buffer` is defined in console

