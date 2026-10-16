# ENotes — Study Notes Dashboard

A subject-based study notes application built with **Next.js**, **React**, and **MongoDB**. ENotes helps you organize technical learning notes, search through content, revise with flashcards, and manage notes from one focused dashboard.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Import existing notes](#import-existing-notes)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Deployment](#deployment)
- [Release readiness](#release-readiness)
- [Security notes](#security-notes)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Home hub** — open the Notes library, Settings, HTML resources, or the import guide from a dedicated landing page.
- **Subject-based organization** — switch between subjects in the Notes library and create or delete subjects from Settings.
- **Note management** — create, edit, read, and delete notes within a subject.
- **Markdown-friendly writing** — write note content with supported Markdown formatting and preview it before saving.
- **Focused reading** — open notes in a full-screen reader.
- **Flashcard study mode** — review notes, reveal answers, and mark material as learned.
- **Search** — filter notes by heading or content.
- **Light and dark themes** — switch themes, with the selected theme saved in the browser.
- **Remembered study state** — the selected subject and learned-note progress are stored locally in the browser.
- **MongoDB persistence** — subjects and notes are stored in MongoDB.
- **Dedicated Settings page** — manage subjects, choose a theme, and access JSON backup and restore outside the note-taking workspace.
- **JSON backup and restore** — download a full backup and safely merge missing records from a validated backup without overwriting existing notes.
- **Starter note import** — migrate the Markdown files in `notes/` into MongoDB using the included script.
- **Additional learning resources** — includes HTML library and import-guide pages.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| UI | React |
| Language | JavaScript (ES modules) |
| Database | MongoDB |
| Database driver | MongoDB Node.js driver |
| Styling | CSS |
| Initial note content | Markdown and JSON |

## Getting started

### Prerequisites

- **Node.js 20.9.0 or newer**
- npm
- A MongoDB database, such as a MongoDB Atlas cluster

### 1. Clone the repository

```bash
git clone https://github.com/nikhil-dex/ENotes.git
cd ENotes
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

Create a local environment file from the example:

**macOS / Linux**
```bash
cp .env.example .env.local
```

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and set the MongoDB connection string and database name as described below.

### 4. Import the starter notes

After configuring the database, run the migration script:

```bash
npm run migrate:notes
```

The script imports the Markdown notes described in `subjects.json` into MongoDB. It uses insert-only upserts for existing records, so rerunning it preserves records already in the database.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server after building |
| `npm run migrate:notes` | Import starter Markdown notes into MongoDB |
| `npm run check:release-env` | Check required production environment values for obvious format and placeholder issues |
| `npm test` | Run security, recovery, workflow, and release-readiness tests |

## Environment variables

Set these variables in `.env.local` for local development and in your hosting provider's environment-variable settings for deployment.

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection URI for your cluster |
| `MONGODB_DB` | No | Database name; defaults to `linux_notes` |
| `ENOTES_ACCESS_KEY` | Setup only | Shared access string used by `npm run access:setup` to generate a hashed MongoDB document |
| `ENOTES_SESSION_SECRET` | Yes for protected access | Separate random secret used to sign session cookies; keep stable and private |

Example configuration:

```dotenv
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DB=linux_notes
```

Replace the placeholders with your own database credentials and cluster host. **Never commit real credentials or your `.env.local` file.**

## Shared access-string protection

ENotes uses a single shared access string instead of individual user accounts. The access page is available at `/access`; the app checks the submitted string on the server and grants a signed, HTTP-only session cookie for one hour. Application pages and API routes are protected by `proxy.js`.

### Configure the access string

1. Copy `.env.example` to `.env.local` and set `MONGODB_URI` and `MONGODB_DB`.
2. Set `ENOTES_ACCESS_KEY` to your chosen access string of exactly 9 characters. Do not commit the real value.
3. Generate a separate session-signing secret (at least 32 characters). For example, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and put the output in `ENOTES_SESSION_SECRET`.
4. Run `npm run access:setup`. This **does not connect to MongoDB**. It prints a MongoDB Extended JSON document containing a salted scrypt hash of your access string.
5. In MongoDB Compass or Atlas Data Explorer, open the database named by `MONGODB_DB` (default: `linux_notes`) and the `settings` collection. Insert the generated document. If `settings` does not exist, create it first. If a document with `_id: "shared-access-key"` already exists, update/replace that document instead of inserting a duplicate.
6. Configure `MONGODB_URI`, `MONGODB_DB`, and `ENOTES_SESSION_SECRET` in Vercel. The database you manually updated must be the same database your Vercel deployment uses. Keep `ENOTES_SESSION_SECRET` stable between deployments. You can remove `ENOTES_ACCESS_KEY` from Vercel after generating the document; it is not used by the runtime verification endpoint.
7. To rotate the access string, change `ENOTES_ACCESS_KEY` in your local `.env.local`, run `npm run access:setup` again, and replace the MongoDB `shared-access-key` document with the newly generated document.

The access string is shared by everyone who has it; this is not individual-user authentication. Anyone with the string can access the same notes, and access is not tied to a named person. Use a unique string and keep the deployment protected. A 9-character shared string is weaker than a longer secret. The session cookie expires after one hour.

## Import existing notes

The initial Markdown content is kept in `notes/`, and `subjects.json` defines the starter subjects and their note-number metadata.

The migration script reads those files and creates the corresponding subject and note records in MongoDB. After import, **MongoDB is the source of truth for the running application**. Editing a Markdown file later does not automatically update its database record.

Back up your database before making manual data changes. The migration script is designed to preserve existing records rather than overwrite them.

## Project structure

```text
ENotes/
├── app/
│   ├── notes/             # Notes workspace
│   ├── settings/          # Subject management, appearance, backup/restore
│   ├── api/
│   │   ├── notes/         # Note API routes
│   │   └── subjects/      # Subject API routes
│   ├── html-library/      # HTML learning-resource page
│   ├── import-guide/      # Note import guide
│   ├── layout.js          # Root application layout
│   └── page.js            # Home hub / app launcher
├── lib/
│   ├── access-session.js  # Signed session creation and validation
│   ├── backup-validation.js # Backup schema validation
│   ├── read-limited-body.js # Bounded request-body reader
│   └── mongodb.js         # MongoDB connection and indexes
├── tests/
│   ├── api-workflows.test.mjs
│   ├── backup-integrity.test.mjs
│   ├── release-readiness.test.mjs
│   └── security-recovery.test.mjs
├── scripts/
│   ├── check-release-env.mjs
│   ├── migrate-notes.mjs
│   └── set-access-key.mjs
├── .env.example
├── next.config.mjs
├── package.json
└── subjects.json
```

## Data model

The application stores two main kinds of documents:

- **Subjects** — subject name, slug, display order, next note number, and related metadata.
- **Notes** — subject slug, note number, heading, content, and saved-time metadata.

MongoDB indexes support subject lookup and note ordering, with a unique constraint on the subject-and-note-number pair.

## Deployment

ENotes can be deployed as a Next.js application on a platform such as Vercel.

1. Import the repository into your hosting provider.
2. Configure `MONGODB_URI` and `MONGODB_DB` in the project's environment variables.
3. Configure MongoDB Atlas network access and a database user with only the permissions the application needs.
4. Run `npm run migrate:notes` from a trusted local environment using the intended database connection to import the starter notes once.
5. Deploy the application and verify that the dashboard can read and update notes.

Do not expose database credentials in client-side code or commit them to source control.

## Backups and restore

Use **Download backup** in the dashboard to export all subjects and notes to a JSON file. Keep this file somewhere private because it contains your study notes.

To restore, choose a backup JSON file from the dashboard. ENotes validates the file format, record limits, subject slugs, note identifiers, and content lengths before writing. Restore uses **merge-only** behavior: missing subjects and notes are added, existing subject metadata and note contents are not overwritten, and duplicate note IDs are skipped. Uploads are limited to 10 MB. Restore is not a substitute for an independent MongoDB backup; keep multiple copies of important backups.

## Release readiness

Before a production release, follow [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md). It covers production environment configuration, deployment smoke tests, backup and restore checks, and final sign-off.

Run this command locally or in CI to catch missing or obviously placeholder environment values:

```bash
npm run check:release-env
```

This is a format check only; it does **not** connect to MongoDB, validate credentials, or confirm that a deployed app is healthy. CI runs this check alongside tests and the production build using test-only values.

## Security notes

The dashboard uses a shared access string, not individual user accounts. Anyone who knows the string can access the same notes. Successful access sessions expire after one hour, and the dashboard has a **Lock** control to clear the current browser's session cookie.

Keep the access string and `ENOTES_SESSION_SECRET` private; use a strong unique session secret (at least 32 characters) and keep MongoDB credentials server-side. Rotating `ENOTES_SESSION_SECRET` invalidates all existing sessions. If you change the shared access string in MongoDB, also rotate `ENOTES_SESSION_SECRET` in your hosting environment and redeploy to force everyone to unlock again. The shared-key setup script is for trusted local use only; do not expose its generated hash/configuration or the original access string in client code.

The proxy protects application pages and API routes unless a route is explicitly public. Security response headers are added at the proxy layer. Cross-origin browser mutation requests (POST, PUT, PATCH, DELETE) are rejected when their Origin does not match the app origin. Access verification and backup restore request bodies are size-limited while being read, not only after buffering. Keep `/api/access/verify` and `/api/access/logout` as the only public access API endpoints.

Also restrict MongoDB network access and database permissions appropriately.

## Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a branch for your change: `git checkout -b feature/your-change`.
3. Make and test your changes.
4. Open a pull request with a clear description of the change.

For bugs or feature ideas, open a GitHub issue with steps to reproduce or a concise use case.

## License

No license file is currently included in this repository. Unless a license is added, the project should be treated as **all rights reserved**; please contact the repository owner before redistributing or reusing it.
