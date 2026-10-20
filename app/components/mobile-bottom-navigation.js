'use client';

import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/notes', label: 'Notes', icon: '▤' },
  { href: '/files', label: 'Files', icon: '▧' },
  { href: '/saved-links', label: 'Links', icon: '↗' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function MobileBottomNavigation() {
  const pathname = usePathname();

  if (!pathname || pathname === '/access' || pathname.startsWith('/access/')) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const active = item.href === '/'
          ? pathname === '/'
          : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <a
            key={item.href}
            href={item.href}
            className={'mobile-bottom-nav-item' + (active ? ' is-active' : '')}
            aria-current={active ? 'page' : undefined}
          >
            <span className="mobile-bottom-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="mobile-bottom-nav-label">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
