export const metadata = {
  title: { default: 'OgeNotes', template: '%s | OgeNotes' },
  description: 'OgeNotes keeps your notes, saved links, learning resources, and revision tools together in one private workspace.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }" }} />
        <link rel="icon" href="/ogenotes-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/ogenotes-icon.svg" />
        <meta name="application-name" content="OgeNotes" />
        <meta name="theme-color" content="#40795e" />
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/extra.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
