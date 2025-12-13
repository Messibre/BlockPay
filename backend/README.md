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
- If you need health check routes, use `/api/v1/health`.
