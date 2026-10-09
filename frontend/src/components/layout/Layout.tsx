import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Products', href: '/products', icon: PackageIcon, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Stock', href: '/stock', icon: BoxIcon, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Sales', href: '/sales', icon: ShoppingCartIcon, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Users', href: '/users', icon: UsersIcon, roles: ['ADMIN'] },
];

// SVG Icons
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3v-2.5h4v-4H6a1 1 0 011-1v-2a1 1 0 011-1h2.586a1 1 0 01.707.293l5.414 5.414c.293.293.767.293 1.05 0l2.707-2.707a1 1 0 011.414 0l.586-.586a1 1 0 00-.707-1.707L9.586 3.5H4a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2v-2a1 1 0 00-1-1H5a1 1 0 01-1-1V9a1 1 0 00-1-1H2" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7v10l8 4" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7v10l8 4" />
    </svg>
  );
}

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-5M5 10l1.5-3 5 5" />
    </svg>
  );
}

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2M9 19V9a2 2 0 00-2-2H5a2 2 0 01-2-2V5a2 2 0 012-2h2M9 5h10a2 2 0 012 2v3a2 2 0 01-2 2h-2v4a2 2 0 012 2h2v4a2 2 0 01-2 2H9a2 2 0 00-2 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2h2V5a2 2 0 012-2h2" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 8 4 4 0 010-8zM21 12c0 1.657-3.43 3-7.5 3S3 13.657 3 12c0-1.657 3.43-3 7.5-3s7.5 1.343 7.5 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 16a4 4 0 01-3.03 3.75A5.98 5.98 0 0014 20H4a2 2 0 01-2-2V7a2 2 0 012-2h2" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Products', href: '/products', icon: PackageIcon, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Stock', href: '/stock', icon: BoxIcon, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Sales', href: '/sales', icon: ShoppingCartIcon, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Reports', href: '/reports', icon: ChartBarIcon, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Users', href: '/users', icon: UsersIcon, roles: ['ADMIN'] },
  ];

  const filteredNavigation = navigation.filter(item => item.roles.includes('ADMIN') || item.roles.includes('MANAGER'));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-gray-900/50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7v10l8 4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Floramagg</span>
            </div>
            <button className="lg:hidden p-2 text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                  ${isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                {user?.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
              </div>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Logout"
              >
                <LogoutIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-16 px-4">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-500 hover:text-gray-700" aria-label="Open menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-xl font-bold text-gray-900">Floramagg</span>
          <div className="w-10"></div>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:pl-64 min-h-screen pt-16 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;