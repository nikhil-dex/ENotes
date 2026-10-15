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
- [Security notes](#security-notes)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Subject-based organization** — create, switch between, and delete subjects.
- **Note management** — create, edit, read, and delete notes within a subject.
- **Markdown-friendly writing** — write note content with supported Markdown formatting and preview it before saving.
- **Focused reading** — open notes in a full-screen reader.
- **Flashcard study mode** — review notes, reveal answers, and mark material as learned.
- **Search** — filter notes by heading or content.
- **Light and dark themes** — switch themes, with the selected theme saved in the browser.
- **Remembered study state** — the selected subject and learned-note progress are stored locally in the browser.
- **MongoDB persistence** — subjects and notes are stored in MongoDB.
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

## Environment variables

Set these variables in `.env.local` for local development and in your hosting provider's environment-variable settings for deployment.

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection URI for your cluster |
| `MONGODB_DB` | No | Database name; defaults to `linux_notes` |

Example configuration:

```dotenv
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DB=linux_notes
```

Replace the placeholders with your own database credentials and cluster host. **Never commit real credentials or your `.env.local` file.**

## Shared access-string protection

ENotes uses a single shared access string instead of individual user accounts. The access page is available at `/access`; the app checks the submitted string on the server and grants a signed, HTTP-only session cookie for seven days. Application pages and API routes are protected by `proxy.js`.

### Configure the access string

1. Copy `.env.example` to `.env.local` and set `MONGODB_URI` and `MONGODB_DB`.
2. Set `ENOTES_ACCESS_KEY` to a strong secret string of at least 12 characters. Do not commit the real value.
3. Generate a separate session-signing secret (at least 32 characters). For example, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and put the output in `ENOTES_SESSION_SECRET`.
4. Run `npm run access:setup`. This stores a salted scrypt hash of the access string in the MongoDB `settings` collection; it does not store the plaintext access string.
5. Keep `ENOTES_SESSION_SECRET` configured in the deployment environment. You can remove `ENOTES_ACCESS_KEY` from the environment after setup; keep it only where you need to rotate the key.
6. Configure the same MongoDB database and `ENOTES_SESSION_SECRET` in your hosting provider. If you change the access string, update `ENOTES_ACCESS_KEY` locally and run `npm run access:setup` again against the intended database.

The access string is shared by everyone who has it; this is not individual-user authentication. Anyone with the string can access the same notes, and access is not tied to a named person. Use a long, unique secret and keep the deployment protected. The session cookie expires after seven days.

## Import existing notes

The initial Markdown content is kept in `notes/`, and `subjects.json` defines the starter subjects and their note-number metadata.

The migration script reads those files and creates the corresponding subject and note records in MongoDB. After import, **MongoDB is the source of truth for the running application**. Editing a Markdown file later does not automatically update its database record.

Back up your database before making manual data changes. The migration script is designed to preserve existing records rather than overwrite them.

## Project structure

```text
ENotes/
├── app/
│   ├── api/
│   │   ├── notes/          # Note API routes
│   │   └── subjects/       # Subject API routes
│   ├── html-library/       # HTML learning-resource page
│   ├── import-guide/       # Note import guide
│   ├── layout.js           # Root application layout
│   └── page.js             # Main notes dashboard
├── lib/
│   └── mongodb.js          # MongoDB connection and indexes
├── notes/
│   ├── devops.md           # Starter DevOps notes
│   ├── linux.md            # Starter Linux notes
│   └── ml.md               # Starter machine-learning notes
├── public/
│   ├── html-library/       # Static HTML resources
│   ├── extra.css
│   └── style.css
├── scripts/
│   └── migrate-notes.mjs   # Markdown-to-MongoDB migration
├── .env.example            # Environment-variable template
├── next.config.mjs
├── package.json
└── subjects.json           # Starter subject configuration
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

## Security notes

**The current dashboard does not implement user authentication.** Anyone who can reach an unprotected deployment may be able to read or modify its notes. For a personal deployment, enable hosting-provider access protection (such as Vercel Deployment Protection) or add proper authentication and authorization before making the application publicly accessible.

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
