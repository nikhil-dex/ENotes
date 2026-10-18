# ENotes Image & PDF Library

This detour is isolated on `feat/image-pdf-library` and does not change the locked roadmap.

## Architecture

- Next.js App Router serves the UI and protected media API.
- MongoDB stores folder/file metadata in `mediaFolders` and `mediaFiles`.
- A private Vercel Blob store stores binary contents. Object keys are generated as `media/<UUID>`; user-supplied names are metadata only.
- The existing `proxy.js` session gate protects the page and API routes, including preview and download streaming.
- Uploads use short-lived, scoped presigned PUT URLs. Preview/download content is streamed through the authenticated application API, so the UI does not expose a public Blob URL.
- JSON backups contain media metadata only, never file bytes.

## Required server environment

Connect the private Blob store to the ENotes Vercel project and select the environments where it should be available. This project uses the custom environment-variable prefix `OGE`.

- `OGE_STORE_ID`: the connected private Blob store ID.
- Vercel supplies `VERCEL_OIDC_TOKEN` automatically at runtime when the project is connected to the store. Do not commit or manually copy OIDC tokens into source control.
- `OGE_WEBHOOK_PUBLIC_KEY` is only needed if a future upload flow verifies Blob completion webhooks; the current library uses a protected completion request instead.

For trusted local development, use Vercel's environment pull workflow or configure a server-side Blob read/write token and the store ID in the local environment. Never expose storage credentials to browser code. Keep the Blob store private.

## Initial limits and safety

- PDF, JPEG, PNG, and WebP only, with matching file extensions and MIME types.
- 20 MiB maximum per file.
- 10,000 metadata records per type and 2,000 folders.
- The existing 8 GB application-tracked storage ceiling is retained. Vercel Blob's included storage allowance may be lower on your plan, so the application cap is not a free-tier or no-charge guarantee. Check storage and data-transfer usage in the Vercel dashboard.
- Folder names reject slashes and control characters.
- A folder cannot be deleted while it contains files.
- File deletion removes the Blob object first; if storage deletion fails, metadata is retained.
- There is no automatic cleanup of abandoned pending uploads yet; review pending records before adding a cleanup job.

## Backup / restore limitation

The regular ENotes JSON backup can include media folder/file metadata, but cannot include the actual binary objects. Restoring this metadata to another database does not copy the Blob files. Keep the private Blob store available when moving the database; a future explicit archive/export feature would be required for a full portable media backup.

## Local verification

```sh
npm ci
npm test
npm run check:release-env
npm run build
```

The media unit tests do not need Blob credentials. Test actual upload/preview/download/delete only against a private Blob store and a non-production database.
