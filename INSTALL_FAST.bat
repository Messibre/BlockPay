@echo off
echo Fast Installation Guide for Windows
echo.
echo Option 1: Use pnpm (Recommended - Fastest)
echo.
echo Step 1: Install pnpm globally
npm install -g pnpm
echo.
echo Step 2: Install frontend dependencies
cd frontend
pnpm install
cd ..
echo.
echo Done! Now run: cd frontend && pnpm run dev
echo.
pause

