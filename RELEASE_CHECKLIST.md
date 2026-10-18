# ENotes Release Readiness Checklist

Use this checklist before calling a production release complete. CI validates code and environment-variable format; it does not prove that the live deployment can reach MongoDB or that a real backup can be restored.

## 1. Repository and CI

- [ ] All intended phase pull requests are merged into `main`.
- [ ] The latest `main` workflow passes `npm ci`, `npm test`, the release-environment format check, and `npm run build`.
- [ ] Review the latest changes and confirm no secrets, local environment files, or private backup exports were committed.
- [ ] Confirm the hosting provider is deploying the intended repository and `main` commit.

## 2. Production environment

- [ ] Set `MONGODB_URI` to the production MongoDB connection URI.
- [ ] Set `MONGODB_DB` to the intended production database name.
- [ ] Set `ENOTES_SESSION_SECRET` to a private, randomly generated value with at least 32 characters. Keep it stable across routine deployments.
- [ ] Do not use a production database for restore tests unless the operation has been reviewed and explicitly approved.
- [ ] Confirm no storage token, access string, or other secret appears in browser bundles or committed files.

## 3. Image & PDF Library (separate detour)

- [ ] Connect a private Vercel Blob store to the project and confirm `OGE_STORE_ID` is set in the intended environments.
- [ ] Confirm Vercel OIDC is available at runtime; never expose storage credentials to browser code.
- [ ] Verify unauthenticated requests cannot reach media APIs and the app streams private content only after session authentication.
- [ ] Upload, preview, download, move, and delete disposable files using a non-production database and private Blob store.
- [ ] Confirm invalid MIME/signature combinations and oversized uploads are rejected.
- [ ] Remember JSON backups include media metadata only; keep the private Blob store and binary objects separately available.
- [ ] Monitor stored bytes and monthly data transfer; the app's 8 GB tracked ceiling does not guarantee zero provider charges.

## 4. Backup and restore

- [ ] Create a fresh JSON backup and verify its format and timestamp.
- [ ] Restore into a disposable or otherwise approved test database.
- [ ] Confirm the restore reports added/skipped records accurately and preserves existing data.
- [ ] Keep the backup outside the public web root and do not commit it to the repository.

## 5. Final release decision

- [ ] Recheck the current branch, commit, tests, and deployment status.
- [ ] Review changes and approve production deployment explicitly before releasing.
