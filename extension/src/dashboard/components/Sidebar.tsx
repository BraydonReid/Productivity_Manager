import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Sessions', icon: '□' },
  { to: '/search', label: 'Search', icon: '⌕' },
  { to: '/journal', label: 'Journal', icon: '✎' },
  { to: '/focus', label: 'Focus', icon: '◉' },
  { to: '/analytics', label: 'Analytics', icon: '▦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar() {
  return (
    <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold">Session Memory</h1>
      </div>
      <div className="flex-1 p-2 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded text-sm ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
