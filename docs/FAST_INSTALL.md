# Fast Installation Guide (For Slow Machines)

If `npm install` is taking too long, here are faster alternatives:

## Option 1: Use Yarn (Faster)

Yarn is generally faster than npm, especially for large projects.

### Install Yarn:
```bash
npm install -g yarn
```

### Install with Yarn:
```bash
cd frontend
yarn install
```

## Option 2: Use pnpm (Fastest)

pnpm is the fastest package manager and uses less disk space.

### Install pnpm:
```bash
npm install -g pnpm
```

### Install with pnpm:
```bash
cd frontend
pnpm install
```

## Option 3: Minimal Dependencies

If you want to skip linting/formatting tools for now:

1. **Stop current npm install** (Ctrl+C)

2. **Use minimal package.json:**
```bash
cd frontend
cp package.json package.json.backup
cp package-minimal.json package.json
npm install
```

This installs only essential dependencies (no ESLint, Prettier, TypeScript types).

You can add linting later when needed.

## Option 4: Install Offline (If You Have Another Machine)

1. On a faster machine/network:
```bash
cd frontend
npm install
```

2. Copy `node_modules` folder to your slow machine

3. Run:
```bash
npm install --offline
```

## Option 5: Use npm with Optimizations

```bash
cd frontend
npm install --prefer-offline --no-audit --legacy-peer-deps
```

## Option 6: Install Dependencies One by One

Install the heaviest packages separately:

```bash
cd frontend

# Core dependencies first
npm install react react-dom --save

# Then Mesh SDK (this is the heavy one)
npm install @meshsdk/core @meshsdk/react --save

# Then others
npm install axios react-router-dom react-query --save

# Dev dependencies last
npm install vite @vitejs/plugin-react --save-dev
```

## Why Is It Slow?

The Mesh SDK packages are large because they include:
- Cardano libraries
- Cryptographic functions
- Transaction builders
- Wallet connectors

This is normal - expect 5-15 minutes on slow machines.

## Recommended Approach

**For your old PC, I recommend:**

1. **Use pnpm** (fastest):
```bash
npm install -g pnpm
cd frontend
pnpm install
```

2. **Or use minimal package.json** (skip linting for now):
```bash
cd frontend
# Stop npm if running
cp package-minimal.json package.json
npm install
```

3. **Be patient** - Mesh SDK is large but necessary for Cardano integration

## Check Progress

While installing, you can check what's happening:
```bash
# In another terminal
cd frontend
ls node_modules  # See what's installed so far
```

## After Installation

Once done, verify:
```bash
cd frontend
npm run dev
```

If it works, you're good! If not, check error messages.

