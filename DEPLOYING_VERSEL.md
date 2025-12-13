# Deploying this repository to Vercel

Two recommended approaches: (A) Two separate Vercel projects — `client` + `backend` (recommended), or (B) a single monorepo Vercel project configured by the root `vercel.json`.

1. Two separate projects (recommended):

- Frontend: create a Vercel project using the `client` folder as the root. Build command: `npm run build`. Output directory: `dist`. Set environment variables starting with `VITE_` (e.g. `VITE_BACKEND_URL`).
- Backend: create another Vercel project using the `backend` folder as the root. It will detect serverless `api/` functions. Set `MONGO_URI`, `JWT_SECRET`, `BLOCKFROST_KEY`, `CLIENT_ORIGINS`, and other necessary environment variables. Set `Client origins` to include your frontend's production URL.

2. Single Vercel project (monorepo):

- Alternatively, create one Vercel project for this repo root. The root `vercel.json` will build the frontend and route `/api/*` to the `backend` functions. Set environment variables in the single project for both frontend and backend (VITE\_\* for frontend, others for backend).

3. Local testing with Vercel CLI:

- Install Vercel CLI: `npm i -g vercel`.
- From the repo root, run `vercel` to deploy or `vercel dev` to run locally. To deploy a specific folder as a project, `cd client && vercel --prod` or `cd backend && vercel --prod`.

4. Notes & tips:

- Keep secrets as Vercel Environment Variables — do not check `.env` into source control.
- For local dev, use `npm run dev:backend` and `npm run dev:client`.
- If using single-project route, ensure your `VITE_BACKEND_URL` is set to the deployed backend URL.
