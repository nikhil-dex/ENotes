import MobileBottomNavigation from './components/mobile-bottom-navigation';
import MobileExperience from './components/mobile-experience';

export const metadata = {
  title: { default: 'OgeNotes', template: '%s | OgeNotes' },
  description: 'OgeNotes keeps your notes, saved links, learning resources, and revision tools together in one private workspace.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark'; var a = localStorage.getItem('accent'); if (a && a !== 'green') document.documentElement.dataset.accent = a; } catch { document.documentElement.dataset.theme = 'dark'; }" }} />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js" defer></script>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="application-name" content="OgeNotes" />
        <meta name="theme-color" content="#40795e" />
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/extra.css" />
        <link rel="stylesheet" href="/news.css" />
      </head>
      <body><MobileExperience>{children}</MobileExperience><MobileBottomNavigation /></body>
    </html>
  );
}
