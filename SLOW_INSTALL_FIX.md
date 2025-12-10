# Fix for Slow npm Install

## Immediate Solution

**Stop the current npm install** (Ctrl+C in the terminal)

Then use one of these faster options:

### Option 1: Use pnpm (FASTEST - Recommended)

```bash
# Install pnpm globally
npm install -g pnpm

# Install frontend dependencies
cd frontend
pnpm install
```

**Why pnpm?**
- 2-3x faster than npm
- Uses less disk space
- Better for old/slow machines

### Option 2: Use Minimal Dependencies

Skip linting/formatting tools for now:

```bash
cd frontend

# Stop npm if still running (Ctrl+C)

# Backup original
cp package.json package.json.full

# Use minimal version
cp package-minimal.json package.json

# Install (much faster - only essential deps)
npm install
```

You can add linting later when needed.

### Option 3: Use Yarn

```bash
npm install -g yarn
cd frontend
yarn install
```

## Why Is It So Slow?

The **Mesh SDK** packages are very large (50-100MB) because they include:
- Full Cardano libraries
- Cryptographic functions  
- Transaction builders
- Wallet connectors

**This is normal** - expect 5-15 minutes on old PCs.

## Recommended Approach for Your Old PC

1. **Stop npm** (Ctrl+C)
2. **Install pnpm**: `npm install -g pnpm`
3. **Use pnpm**: `cd frontend && pnpm install`
4. **Wait 5-10 minutes** (still slow but faster than npm)

OR

1. **Stop npm** (Ctrl+C)
2. **Use minimal package.json**: `cp package-minimal.json package.json`
3. **Install**: `npm install`
4. **Much faster** (skips linting tools)

## Check Progress

While installing, you can check:
```bash
# See what's installed
cd frontend
ls node_modules | wc -l  # Count installed packages

# Or just wait - it will finish eventually
```

## After Installation

Once done, test it:
```bash
cd frontend
npm run dev
# or
pnpm run dev
```

If it starts without errors, you're good!

## If Installation Fails

1. **Clear cache and retry:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

2. **Check internet connection** - Mesh SDK downloads are large

3. **Try offline mode** (if you have node_modules from another machine):
```bash
npm install --offline
```

## Next Steps After Install

1. ✅ Dependencies installed
2. ⚠️ Check [CHECKLIST.md](CHECKLIST.md) for missing items
3. ⚠️ See [docs/FIXES.md](docs/FIXES.md) for critical fixes
4. 🚀 Start building!

