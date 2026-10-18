'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/notes', label: 'Notes' },
  { href: '/saved-links', label: 'Saved Links' },
  { href: '/quick-notes', label: 'Quick Notes' },
  { href: '/settings', label: 'Settings' },
  { href: '/html-library', label: 'HTML files' },
  { href: '/revision-history', label: 'Revision history' },
  { href: '/import-guide', label: 'Import guide' },
];

export default function SiteNavbar({ actions = null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-navbar">
      <a className="brand" href="/" aria-label="ENotes home" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark">N</span>
        <span>Study<span className="brand-light">Notes</span></span>
      </a>

      <button
        className="site-navbar-toggle"
        type="button"
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        aria-controls="site-navbar-content"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
      </button>

      <div id="site-navbar-content" className={`site-navbar-content${menuOpen ? ' is-open' : ''}`}>
        <nav className="site-navbar-links" aria-label="Main navigation">
          {links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <a
                href={link.href}
                key={link.href}
                className={`site-navbar-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
        {actions && <div className="site-navbar-actions">{actions}</div>}
      </div>
    </header>
  );
}
