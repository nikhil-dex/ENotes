export const metadata = {
  title: 'Notes Dashboard',
  description: 'Organize, read, and study notes by subject.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/extra.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
