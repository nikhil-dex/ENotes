# ENotes Image & PDF Library

This detour is isolated on `feat/image-pdf-library` and does not change the locked roadmap.

## Architecture

- Next.js App Router serves the UI and protected media API.
- MongoDB stores folder/file metadata in `mediaFolders` and `mediaFiles`.
- A private Cloudflare R2 bucket stores the binary contents. Object keys are generated as `media/<UUID>`; user-supplied names are metadata only.
- The existing `proxy.js` session gate protects the page and API routes.
- Upload and download transfers use short-lived, signed R2 URLs. A JSON backup contains metadata only, never file bytes.

## Required server environment

Set these only in trusted local environment settings and the hosting provider's server-side environment settings:

- `R2_ACCOUNT_ID`: Cloudflare account ID (32 hexadecimal characters).
- `R2_BUCKET_NAME`: private R2 bucket name.
- `R2_ACCESS_KEY_ID`: R2 S3-compatible access key ID.
- `R2_SECRET_ACCESS_KEY`: matching secret access key.

No values are required at build time. The library returns a clear configuration error until these are set. Never commit credentials or make the bucket public.

## R2 bucket and CORS

Create a private R2 bucket and an API token limited to the target bucket. Configure bucket CORS for the exact ENotes origin(s) that will upload from a browser:

- Allowed methods: `PUT`, `GET`, `HEAD`
- Allowed request headers: `content-type`
- Expose headers: `content-length`, `content-type`
- Max age: `3600`

Use your local development origin for local tests and the eventual application origin only when you're ready to test a preview. Do not use a wildcard origin for private application uploads.

The browser PUT upload sends the selected file's Content-Type. The API checks the recorded size against a server-side HEAD request before marking the metadata ready. The bucket remains private; presigned URLs are temporary bearer tokens valid for five minutes.

## Initial limits and safety

- PDF, JPEG, PNG, and WebP only, with matching file extensions and MIME types.
- 20 MiB maximum per file.
- 10,000 metadata records per type and 2,000 folders.
- A 9 GiB application-tracked storage ceiling leaves headroom below R2's commonly listed 10 GB free storage allowance. This is a safeguard, not a guarantee of zero charges: usage-based billing, orphaned objects, and provider pricing/allowances must still be checked in the Cloudflare dashboard.
- Folder names reject slashes and control characters.
- A folder cannot be deleted while it contains files.
- File deletion removes the R2 object first; if storage deletion fails, metadata is retained.
- There is no automatic cleanup of abandoned pending uploads yet; review pending records before adding a cleanup job.

## Backup / restore limitation

The regular ENotes JSON backup can include media folder/file metadata, but cannot include the actual binary objects. Restoring this metadata to another database does not copy the R2 files. Keep the R2 bucket and credentials intact when moving the database; a future explicit archive/export feature would be required for a full portable media backup.

## Local verification

Run:

```sh
npm test
npm run check:release-env
npm run build
```

The media unit tests do not need R2 credentials. Test actual upload/preview/download/delete only against a disposable private bucket and a non-production database.
