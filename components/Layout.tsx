
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';
import { db } from '../db';
import { UserRole } from '../types';
import { theme } from '../theme';
import { useAuth } from '../src/contexts/AuthProvider';
import { useSearch } from '../src/contexts/SearchContext';
import { fetchCompanySettings } from '../src/services/supabaseQueries';

interface SidebarItemProps {
  to?: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
  children?: { to: string; label: string; active: boolean }[];
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon, label, active, onClick, children }) => {
  const [isOpen, setIsOpen] = useState(active);

  if (children) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between w-full px-4 py-3 ${theme.radius.md} ${theme.transitions.normal} ${
            active 
              ? `${theme.colors.primary[50]} ${theme.colors.primary.text}` 
              : `text-gray-500 hover:${theme.colors.primary[50]} hover:${theme.colors.primary.text}`
          }`}
        >
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-semibold text-sm">{label}</span>
          </div>
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
            {ICONS.ChevronRight}
          </div>
        </button>
        {isOpen && (
          <div className="pl-11 space-y-1">
            {children.map((child) => (
              <Link
                key={child.to}
                to={child.to}
                onClick={onClick}
                className={`block px-4 py-2 text-sm font-medium ${theme.radius.sm} ${theme.transitions.normal} ${
                  child.active 
                    ? `${theme.colors.primary[600]} text-white` 
                    : `text-gray-400 hover:${theme.colors.primary.text} hover:${theme.colors.primary[50]}/30`
                }`}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={to || '#'}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 ${theme.radius.md} ${theme.transitions.normal} ${
        active 
          ? `${theme.colors.primary[600]} text-white shadow-lg shadow-emerald-200/50` 
          : `text-gray-500 hover:${theme.colors.primary[50]} hover:${theme.colors.primary.text}`
      }`}
    >
      {icon}
      <span className="font-semibold text-sm">{label}</span>
    </Link>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState({ name: db.settings.company.name, logo: db.settings.company.logo });
  
  // Use profile from Auth context if available, fallback to db.currentUser
  const user = profile || db.currentUser;

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await fetchCompanySettings();
        setCompanySettings(settings);
      } catch (err) {
        console.error('Failed to load company settings:', err);
      }
    };
    loadSettings();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Reset main scroll position when route changes so each page starts at top
  React.useEffect(() => {
    // main is the scrollable container in this layout
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
    // also reset window scroll as a fallback
    try { window.scrollTo(0, 0); } catch (e) {}
  }, [location.pathname]);

  return (
    <div className={`${theme.colors.bg.secondary} flex overflow-hidden`} style={{ minHeight: '100vh' }}>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 ${theme.colors.bg.primary} border-r ${theme.colors.border.primary} ${theme.transitions.normal} transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-8">
            <div className="flex items-center gap-3">
              <div className={`p-1 ${theme.colors.primary[50]} rounded-[50%]`}>
                {companySettings.logo && (
                  <img src={companySettings.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                )}
              </div>
              <div>
                <h1 className={`text-xl font-black ${theme.colors.text.primary} tracking-tight leading-none`}>{companySettings.name}</h1>
                <span className={`text-[10px] font-bold uppercase tracking-widest`}>Management</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            <SidebarItem to="/dashboard" icon={ICONS.Dashboard} label="Dashboard" active={isActive('/dashboard')} onClick={() => setIsSidebarOpen(false)} />
            
            <SidebarItem to="/products" icon={ICONS.Products} label="Products" active={isActive('/products')} onClick={() => setIsSidebarOpen(false)} />

            <SidebarItem 
              icon={ICONS.Sales} 
              label="Sales" 
              active={isActive('/orders') || isActive('/customers')} 
              children={[
                { to: '/orders', label: 'Orders', active: isActive('/orders') },
                { to: '/customers', label: 'Customers', active: isActive('/customers') }
              ]}
              onClick={() => setIsSidebarOpen(false)}
            />

            {user.role === UserRole.ADMIN && (
              <>
                <SidebarItem 
                  icon={ICONS.Briefcase} 
                  label="Purchases" 
                  active={isActive('/bills') || isActive('/vendors')} 
                  children={[
                    { to: '/bills', label: 'Bills', active: isActive('/bills') },
                    { to: '/vendors', label: 'Vendors', active: isActive('/vendors') }
                  ]}
                  onClick={() => setIsSidebarOpen(false)}
                />
                <SidebarItem 
                  icon={ICONS.Banking} 
                  label="Banking" 
                  active={isActive('/banking')} 
                  children={[
                    { to: '/banking/accounts', label: 'Accounts', active: isActive('/banking/accounts') },
                    { to: '/banking/transactions', label: 'Transactions', active: isActive('/banking/transactions') },
                    { to: '/banking/transfer', label: 'Transfer', active: isActive('/banking/transfer') }
                  ]}
                  onClick={() => setIsSidebarOpen(false)}
                />
              </>
            )}

            {user.role === UserRole.ADMIN && (
              <>
                <SidebarItem to="/reports" icon={ICONS.Reports} label="Reports" active={isActive('/reports')} onClick={() => setIsSidebarOpen(false)} />
                <SidebarItem to="/users" icon={ICONS.Users} label="Users" active={isActive('/users')} onClick={() => setIsSidebarOpen(false)} />
                <SidebarItem to="/settings" icon={ICONS.Settings} label="Settings" active={isActive('/settings')} onClick={() => setIsSidebarOpen(false)} />
              </>
            )}
          </nav>


        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className={`flex-shrink-0 sticky top-0 z-40 ${theme.colors.bg.primary}/80 backdrop-blur-lg border-b ${theme.colors.border.primary} px-6 h-20 flex items-center justify-between`}>
          <button onClick={() => setIsSidebarOpen(true)} className={`lg:hidden p-2.5 hover:${theme.colors.bg.tertiary} ${theme.radius.md} ${theme.colors.text.secondary} border ${theme.colors.border.primary}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>

          <div className="flex-1 max-w-xl mx-4 relative group hidden sm:block">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-300 group-focus-within:${theme.colors.primary.text} ${theme.transitions.normal}`}>
              {ICONS.Search}
            </div>
            <input 
              type="text" 
              placeholder="Search orders, invoices, or customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`block w-full pl-11 pr-4 py-2.5 ${theme.colors.bg.secondary} border-transparent focus:${theme.colors.bg.primary} focus:ring-2 focus:ring-[#3c5a82] focus:border-transparent ${theme.radius.md} text-sm ${theme.transitions.normal}`} 
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsPlusOpen(!isPlusOpen)} className={`${theme.colors.primary[600]} text-white w-10 h-10 flex items-center justify-center ${theme.radius.md} hover:${theme.colors.primary[700]} ${theme.transitions.normal} shadow-lg shadow-[#0f2f57]/20 active:scale-95`}>
                {ICONS.Plus}
              </button>
              {isPlusOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPlusOpen(false)}></div>
                  <div className={`absolute right-0 mt-3 w-56 ${theme.colors.bg.primary} border ${theme.colors.border.primary} rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in slide-in-from-top-2 duration-200 origin-top-right`}>
                    <div className={`px-4 py-2 text-[10px] font-bold ${theme.colors.text.tertiary} uppercase tracking-widest border-b ${theme.colors.border.primary} mb-1`}>Quick Actions</div>
                    {[
                      { label: 'New Order', to: '/orders/new', icon: ICONS.Sales },
                      { label: 'New Bill', to: '/bills/new', icon: ICONS.Briefcase },
                      { label: 'New Customer', to: '/customers/new', icon: ICONS.Customers },
                      { label: 'New Vendor', to: '/vendors/new', icon: ICONS.Vendors },
                      { label: 'Add Income', to: '/transactions/new/income', icon: ICONS.PlusCircle },
                      { label: 'Add Expense', to: '/transactions/new/expense', icon: ICONS.Delete },
                    ].map((item) => (
                      <Link key={item.label} to={item.to} onClick={() => setIsPlusOpen(false)} className={`flex items-center gap-3 px-4 py-3 text-sm font-bold ${theme.colors.text.primary} hover:${theme.colors.primary[50]} hover:${theme.colors.primary.text} ${theme.transitions.normal}`}>
                        <span className="opacity-70">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-3 pl-4 border-l ${theme.colors.border.primary} hover:opacity-70 ${theme.transitions.normal}`}
              >
                <div className="text-right hidden md:block">
                  <p className={`text-sm font-black ${theme.colors.text.primary} leading-none`}>{user.name}</p>
                  <p className={`text-[10px] font-bold ${theme.colors.primary.text} uppercase tracking-widest mt-1`}>{user.role}</p>
                </div>
                <img src={user.image || `https://ui-avatars.com/api/?name=${user.name}&background=0f2f57&color=fff`} alt="Profile" className="w-10 h-10 rounded-[50%] object-cover cursor-pointer" />
              </button>
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className={`absolute right-0 mt-3 w-48 ${theme.colors.bg.primary} border ${theme.colors.border.primary} rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in slide-in-from-top-2 duration-200 origin-top-right`}>
                    <button
                      onClick={() => {
                        navigate(`/users/${user.id}`);
                        setIsProfileOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-bold ${theme.colors.primary.text} hover:${theme.colors.primary[50]} ${theme.transitions.normal}`}
                    >
                      {ICONS.Users}
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsProfileOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-bold ${theme.colors.danger.text} hover:${theme.colors.danger[50]} ${theme.transitions.normal}`}
                    >
                      {ICONS.LogOut}
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 animate-in fade-in duration-500 relative">
          {children}
          <footer className={`mt-20 py-8 border-t ${theme.colors.border.primary} flex flex-col items-center gap-2`}>
            <p className={`text-sm font-medium ${theme.colors.text.secondary}`}>© {new Date().getFullYear()} {companySettings.name}. All rights reserved.</p>
            <a href="https://sajedurrahmanfiad.me" target="_blank" rel="noreferrer" className={`group flex items-center gap-1.5 text-[11px] font-bold ${theme.colors.text.secondary} hover:${theme.colors.primary.text} ${theme.transitions.normal} uppercase tracking-widest`}>
              Developed by <span className={`${theme.colors.text.secondary} group-hover:${theme.colors.primary.text} underline underline-offset-4 decoration-[#0f2f57]/20`}>Md Sajedur Rahman Fiad</span>
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Layout;
