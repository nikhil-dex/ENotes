# Study Notes

A subject based notes dashboard built with Next.js App Router and MongoDB. It includes Markdown editing and preview, full screen reading, flashcard study mode, search, dark mode, and note or subject deletion.

## Run locally

1. Copy `.env.example` to `.env.local` and set `MONGODB_URI` to your Atlas connection string. Optionally change `MONGODB_DB`.
2. Install packages with `npm install`.
3. Import the current Markdown notes once with `npm run migrate:notes`.
4. Start Next.js with `npm run dev` and open `http://localhost:3000`.

## Deploy to Vercel

Import the project as a Next.js app. Add `MONGODB_URI` and `MONGODB_DB` to the Vercel project's environment variables, then deploy. Run the migration script once from a trusted local machine using the same connection string to copy the current `notes/*.md` content into MongoDB.

Create a MongoDB Atlas database user with access to the app database, and configure Atlas network access so the Vercel application can connect. Keep the connection string in environment variables; never commit it.

## Data model

- `subjects`: subject name, slug, ordering, and next serial number.
- `notes`: one document per note, with subject slug, serial number, heading, answer, and saved time.

The Markdown files in `notes/` are the migration source. After import, MongoDB is the source of truth; changes made directly to those files do not update the database. The migration script is safe to rerun: it inserts missing records and preserves existing MongoDB notes.

## Access control

The dashboard API currently has no user login. Enable Vercel Deployment Protection for a personal deployment so other visitors cannot read or change your notes.
