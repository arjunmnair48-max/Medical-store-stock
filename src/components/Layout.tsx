import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/medicines', label: 'Medicines & Disposables' },
  { to: '/assets', label: 'Non-Disposable Assets' },
  { to: '/reports', label: 'Printable Reports' },
  { to: '/backup', label: 'Backup & Restore' },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="org">NIPER Hajipur</div>
          <div className="sub">Medical Centre &mdash; Stock Register</div>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
