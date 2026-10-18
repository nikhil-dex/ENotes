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
- [ ] Do not use values from `.env.example` in production.
- [ ] Configure MongoDB network access and a database user with only the permissions the application requires.
- [ ] Confirm credentials and secrets are stored only in the hosting provider's environment settings and trusted local secret storage.

## 3. Deployment smoke tests

Run these checks against the deployed app using a valid access session:

- [ ] The access page loads and valid shared access grants a session.
- [ ] An invalid access string is rejected.
- [ ] An unauthenticated request to a protected page redirects to `/access`.
- [ ] Notes, subjects, Settings, and the HTML resource pages load.
- [ ] Create, edit, search, read, and delete a disposable test note; confirm the change persists after a reload.
- [ ] Create and remove a disposable test subject only after confirming it contains no needed notes.
- [ ] Confirm browser theme and learned-note state behave as expected.

## 4. Private Image & PDF Library (if enabled)\n\n- [ ] Configure R2 server-side variables with a bucket-scoped API token; never use a public bucket.\n- [ ] Configure CORS for only the expected ENotes origin(s), with PUT/GET/HEAD and the required content-type header.\n- [ ] Verify unauthenticated requests cannot reach media APIs and direct public object URLs are not available.\n- [ ] Upload, preview, download, move, and delete disposable test files using a non-production database and private test bucket.\n- [ ] Confirm invalid MIME/signature combinations are rejected and failed uploads are cleaned up where possible.\n- [ ] Remember JSON backups include media metadata only; keep the R2 bucket and binary objects separately available.\n\n## 5. Backup and recovery

- [ ] Download a fresh JSON backup and store it privately outside the repository.
- [ ] Verify the downloaded file is non-empty valid JSON and includes the expected subject and note counts.
- [ ] Use a staging/test database to verify restoring a backup adds missing records and does not overwrite existing notes.
- [ ] Test an invalid backup file and an oversized file; both should be rejected without modifying data.
- [ ] Confirm the reported restore counts and inspect the restored data in the test database.
- [ ] Do not run destructive restore experiments against production data.

## 6. Final sign-off

- [ ] Inspect hosting logs after smoke tests; investigate unexpected 4xx/5xx errors.
- [ ] Confirm the deployment is healthy after a fresh session and a second page load.
- [ ] Record the deployed commit SHA, verification date, and any known limitations.
- [ ] If any required check fails, pause release sign-off and fix the issue before proceeding.

## Important limitations

- The environment checker validates presence and basic format only; it does not connect to MongoDB or verify credentials.
- CI uses test-only environment values and does not access production data.
- Backup restore is merge-only and can partially add records if a database operation fails. Always keep a fresh backup and validate recovery against a staging database before relying on it.
