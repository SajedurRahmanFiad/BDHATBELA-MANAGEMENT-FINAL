
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';
import { db } from '../db';
import { UserRole } from '../types';

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
          className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-300 ${
            active 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
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
                className={`block px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  child.active 
                    ? 'text-emerald-600 bg-emerald-50/50' 
                    : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/30'
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
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        active 
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200/50' 
          : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const user = db.currentUser;

  const handleLogout = () => {
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transition-transform duration-300 transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-8">
            <div className="flex items-center gap-3">
              <div className="p-1 bg-emerald-50 rounded-xl">
                 <img src={db.settings.company.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">{db.settings.company.name}</h1>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Financials</span>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            <SidebarItem to="/dashboard" icon={ICONS.Dashboard} label="Dashboard" active={isActive('/dashboard')} onClick={() => setIsSidebarOpen(false)} />
            
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

            <SidebarItem to="/products" icon={ICONS.Products} label="Products" active={isActive('/products')} onClick={() => setIsSidebarOpen(false)} />

            {user.role === UserRole.ADMIN && (
              <>
                <SidebarItem to="/reports" icon={ICONS.Reports} label="Reports" active={isActive('/reports')} onClick={() => setIsSidebarOpen(false)} />
                <SidebarItem to="/users" icon={ICONS.Users} label="Users" active={isActive('/users')} onClick={() => setIsSidebarOpen(false)} />
                <SidebarItem to="/settings" icon={ICONS.Settings} label="Settings" active={isActive('/settings')} onClick={() => setIsSidebarOpen(false)} />
              </>
            )}
          </nav>

          <div className="p-6 border-t border-gray-50">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold text-sm"
            >
              {ICONS.LogOut}
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="flex-shrink-0 sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 h-20 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2.5 hover:bg-gray-50 rounded-xl text-gray-500 border border-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>

          <div className="flex-1 max-w-xl mx-4 relative group hidden sm:block">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-300 group-focus-within:text-emerald-500 transition-colors">
              {ICONS.Search}
            </div>
            <input type="text" placeholder="Search orders, invoices, or customers..." className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent rounded-xl text-sm transition-all" />
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsPlusOpen(!isPlusOpen)} className="bg-emerald-600 text-white w-10 h-10 flex items-center justify-center rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95">
                {ICONS.Plus}
              </button>
              {isPlusOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPlusOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-56 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in slide-in-from-top-2 duration-200 origin-top-right">
                    <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">Quick Actions</div>
                    {[
                      { label: 'New Order', to: '/orders/new', icon: ICONS.Sales },
                      { label: 'New Bill', to: '/bills/new', icon: ICONS.Briefcase },
                      { label: 'New Customer', to: '/customers/new', icon: ICONS.Customers },
                      { label: 'New Vendor', to: '/vendors/new', icon: ICONS.Vendors },
                      { label: 'Add Income', to: '/transactions/new/income', icon: ICONS.PlusCircle },
                      { label: 'Add Expense', to: '/transactions/new/expense', icon: ICONS.Delete },
                    ].map((item) => (
                      <Link key={item.label} to={item.to} onClick={() => setIsPlusOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                        <span className="opacity-70">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
              <div className="text-right hidden md:block">
                <p className="text-sm font-black text-gray-900 leading-none">{user.name}</p>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">{user.role}</p>
              </div>
              <img src={user.image || `https://ui-avatars.com/api/?name=${user.name}&background=10b981&color=fff`} alt="Profile" className="w-10 h-10 rounded-xl border-2 border-emerald-50 object-cover shadow-sm" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 animate-in fade-in duration-500 relative">
          {children}
          <footer className="mt-20 py-8 border-t border-gray-100 flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-gray-400">© {new Date().getFullYear()} {db.settings.company.name}. All rights reserved.</p>
            <a href="https://sajedurrahmanfiad.me" target="_blank" rel="noreferrer" className="group flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-emerald-600 transition-all uppercase tracking-widest">
              Developed by <span className="text-gray-500 group-hover:text-emerald-600 underline underline-offset-4 decoration-emerald-200">Md Sajedur Rahman Fiad</span>
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Layout;
