# Browser Quick Note Extension

Phase 5: floating browser capture widget for ENotes Quick Notes.

- Chrome Manifest V3 content script adds a floating widget to HTTP/HTTPS pages.
- Saves only to the existing `quickNotes` collection through a dedicated scoped API.
- First line becomes the title using `quickNoteTitle`.
- Authenticated ENotes setup page issues one-time pairing codes; the extension exchanges a code for a 90-day bearer token.
- Pairing codes and bearer tokens are stored server-side as hashes. Token scope is `quick-notes:create` only.
- Tokens can be revoked from ENotes. No shared access string or MongoDB credentials are embedded in the extension.

Set `ENOTES_EXTENSION_ID=odbkddlkdjcmookpoaechkjplnofedpi` in the hosting environment. The fixed ID comes from the public key in `browser-extension/manifest.json`.

Load `browser-extension/` using `chrome://extensions` → Developer mode → Load unpacked. Pair from the authenticated ENotes **Browser quick notes** page, then save a test note from a website. Confirm it appears on the existing Quick Notes page and test revocation before production use.
