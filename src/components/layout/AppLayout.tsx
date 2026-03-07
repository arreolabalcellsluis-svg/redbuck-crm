import { ReactNode, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AppSidebar from './AppSidebar';
import { Menu, Search, Bell } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { sidebarOpen, setSidebarOpen } = useAppContext();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 rounded-md hover:bg-muted">
              <Menu size={20} />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-accent transition-colors"
            >
              <Search size={15} />
              <span className="hidden sm:inline">Buscar...</span>
              <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-background border font-mono">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg mx-4 bg-card rounded-xl border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              <Search size={18} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                placeholder="Buscar clientes, productos, pedidos..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted border font-mono text-muted-foreground">ESC</kbd>
            </div>
            <div className="p-4 text-sm text-muted-foreground text-center">
              Escribe para buscar en todo el sistema
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
