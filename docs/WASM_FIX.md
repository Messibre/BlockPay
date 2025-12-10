# Fixing WebAssembly (WASM) Error in Vite

## Problem

Mesh SDK uses WebAssembly files for cryptographic operations, and Vite needs special configuration to handle them.

Error message:
```
"ESM integration proposal for Wasm" is not supported currently.
```

## Solution

### Step 1: Install vite-plugin-wasm

```bash
cd frontend
pnpm add -D vite-plugin-wasm
# or
npm install -D vite-plugin-wasm
```

### Step 2: Update vite.config.js

The config has been updated to include:
- `vite-plugin-wasm` plugin
- Worker configuration for WASM
- OptimizeDeps exclusion for Mesh SDK

### Step 3: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
cd frontend
pnpm run dev
# or
npm run dev
```

## Alternative Solution (If Plugin Doesn't Work)

If `vite-plugin-wasm` still causes issues, try this simpler config:

```javascript
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    exclude: ["@meshsdk/core", "@meshsdk/react"],
  },
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
});
```

Then import Mesh SDK with explicit WASM handling:

```javascript
// In your components, import like this:
import { MeshProvider } from "@meshsdk/react";
// Mesh SDK will handle WASM internally
```

## Why This Happens

- Mesh SDK uses WebAssembly for:
  - Cryptographic operations
  - Transaction building
  - Address derivation
  - Signature verification

- Vite 5.x requires plugins to handle WASM files properly
- The `vite-plugin-wasm` plugin enables WASM support

## Verification

After fixing, you should see:
- No WASM errors in console
- Wallet connection works
- Mesh SDK functions properly

If errors persist, check:
1. Plugin is installed: `pnpm list vite-plugin-wasm`
2. Config is correct (see above)
3. Dev server restarted
4. Browser cache cleared (Ctrl+Shift+R)

