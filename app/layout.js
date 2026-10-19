export const metadata = {
  title: 'Notes Dashboard',
  description: 'Organize, read, and study notes by subject.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }" }} />
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/extra.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
