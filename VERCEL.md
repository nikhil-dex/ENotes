# Deploying the notes dashboard to Vercel

The dashboard uses Vercel Functions for its API and a **private Vercel Blob store** for saved Markdown. Vercel Function filesystems are read-only, so deployed changes are stored in Blob under names such as `notes/linux.md` and `notes/subjects.json`. The committed Markdown files seed the store on first use.

## Setup

1. Import this project into Vercel, or link it with `vercel link`.
2. In the Vercel dashboard, create a **private Blob store** and connect it to this project. This provides the Blob credentials to the Functions.
3. Deploy with `vercel`, or push the linked Git branch to trigger a deployment.

The project serves `public/` as the static site and `api/` as serverless functions. `package.json` installs `@vercel/blob` during deployment.

## Local development

- `node server.js` runs the local-file version and writes to `notes/`.
- `vercel dev` runs the Vercel Functions locally. Connect a Blob store and pull its environment variables first with `vercel env pull .env.local`.

The Blob files persist independently from deployments. Local edits made with `node server.js` do not automatically sync back to the Blob store.

## Access control

The Blob store is private, but the current API routes do not require a user login. Before using this as a private notes site, enable Vercel Deployment Protection for the deployment so visitors cannot read or change notes through the API.
