# ENotes Quick Note browser extension

A Manifest V3 extension that adds a floating note widget to web pages and saves content to ENotes' existing standalone **Quick Notes** collection.

## Install locally

1. Open Chrome and visit `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose the `browser-extension` folder.
4. Open your authenticated ENotes website and visit **Browser quick notes** in the navigation.
5. Generate a one-time pairing code.
6. Click the extension icon, enter the ENotes base URL, paste the code, and connect. Approve host access for that ENotes origin.
7. Visit a website; use the floating **N** button in the bottom-right corner to write and save a note.

The first line becomes the title, matching ENotes' existing Quick Notes behavior. Notes are saved to the same `quickNotes` MongoDB collection and appear in the existing Quick Notes page.

## Security

- The extension never contains MongoDB credentials or the shared ENotes access string.
- Pairing codes expire after five minutes and can be used once.
- The extension receives a random bearer token with only the `quick-notes:create` scope; the server stores a SHA-256 hash.
- Tokens expire after 90 days. Use **Browser quick notes → Revoke all extension access** to invalidate all extension tokens immediately.
- The token API accepts requests only from the extension's fixed Chrome origin. Do not change the public manifest key after release, or the extension ID will change.
- The extension requests network access only for the ENotes origin entered by the user. To display the floating widget on arbitrary HTTP/HTTPS pages, Chrome also requires page access for those sites; the content script does not read page content or send page data to ENotes.

## Server configuration

Set `ENOTES_EXTENSION_ID=odbkddlkdjcmookpoaechkjplnofedpi` in the ENotes hosting environment. No extra database URI or access key is required.

This version creates Quick Notes only; it cannot read, edit, or delete existing notes from the extension. Manage saved notes in ENotes itself.
