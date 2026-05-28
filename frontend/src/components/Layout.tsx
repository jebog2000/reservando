import { useEffect, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CalendarDays, ClipboardList, Search, LogOut, User, Users, Building, Settings, ChevronDown, ChevronRight, Menu, X, Printer, Contact } from 'lucide-react';

interface UserData {
  id: string;
  email?: string;
  name?: string;
}

const settingsItems = [
  { path: '/saloes', label: 'Salões', icon: Building },
  { path: '/usuarios', label: 'Usuários', icon: Users },
  { path: '/impressoras', label: 'Impressoras', icon: Printer },
];

export default function Layout() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isSettingsActive = settingsItems.some((item) => location.pathname === item.path);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await client.auth.me();
        if (response?.data) {
          setUser(response.data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (isSettingsActive) {
      setSettingsOpen(true);
    }
  }, [isSettingsActive]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await client.auth.logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e]">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#f59e0b] rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Sistema de Reservas</h1>
          <p className="text-gray-500 mb-6">Faça login para acessar o sistema</p>
          <Button
            onClick={() => client.auth.toLogin()}
            className="w-full bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: CalendarDays },
    { path: '/reservas', label: 'Reservas', icon: ClipboardList },
    { path: '/consultar', label: 'Consultar', icon: Search },
    { path: '/clientes', label: 'Clientes', icon: Contact },
  ];

  const bottomNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: CalendarDays },
    { path: '/reservas', label: 'Reservas', icon: ClipboardList },
    { path: '/consultar', label: 'Consultar', icon: Search },
    { path: '/clientes', label: 'Clientes', icon: Contact },
    { path: '/saloes', label: 'Configurações', icon: Settings },
  ];

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#f59e0b] rounded-full flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Reservando</h1>
            <p className="text-xs text-white/60">Gestão de Reservas</p>
          </div>
          {/* Close button for mobile overlay */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto md:hidden p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Configurações collapsible section */}
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full text-left ${
            isSettingsActive
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium flex-1">Configurações</span>
          {settingsOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {settingsOpen && (
          <div className="space-y-1 pl-4">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50 print:bg-white print:block">
      {/* Mobile Top Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#1e3a5f] text-white h-14 flex items-center px-4 md:hidden print:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-8 h-8 bg-[#f59e0b] rounded-full flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">Reservando</span>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Slide-over sidebar */}
          <aside className="absolute top-0 left-0 bottom-0 w-64 bg-[#1e3a5f] text-white flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#1e3a5f] text-white flex-col print:hidden">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto print:overflow-visible pt-14 pb-16 md:pt-0 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 h-16 flex items-center justify-around md:hidden print:hidden">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/saloes'
            ? isSettingsActive
            : location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-[#1e3a5f]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#f59e0b]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}