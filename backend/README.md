# Backend deployment with Vercel

This folder is intended to be deployed as a serverless API project on Vercel. It includes a serverless wrapper at `api/catchall.js` which forwards `/api/*` requests to the Express app in `src/app.js`.

Steps to deploy:

- Create a new Vercel project and set the `Root Directory` to `backend`.
- Set the project's environment variables in the Vercel dashboard (see `.env.example`). Important keys: `MONGO_URI`, `JWT_SECRET`, `BLOCKFROST_KEY`, `CLIENT_ORIGINS`, `ESCROW_SCRIPT_ADDRESS`.
- Deploy from the dashboard or run `vercel --prod` from this folder.

Local development:

- Copy `.env.example` to `.env` and fill values.
- Run `npm install` and `npm run dev`.

Notes:

- Vercel serverless functions will re-use connections between requests where possible. The wrapper caches the MongoDB connection to avoid re-connecting each invocation.
- The `POST /contracts/:id/deposit` endpoint accepts `amount` in either ADA (e.g. `300`) or lovelace (e.g. `300000000`). The backend will detect the unit and convert to lovelace for on-chain verification.
- Make sure `BLOCKFROST_KEY` is set and valid for the chosen network. If using preprod/testnet transactions, ensure `NETWORK` is not set to `mainnet` (default is preprod). Use the health endpoint (`GET /api/v1/health`) to check Blockfrost connectivity and permissions.
- If you need health check routes, use `/api/v1/health`.
