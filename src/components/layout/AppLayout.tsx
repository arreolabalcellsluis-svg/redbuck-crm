import { ReactNode } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AppSidebar from './AppSidebar';
import { Menu, Bell } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const { sidebarOpen, setSidebarOpen } = useAppContext();

  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 rounded-md hover:bg-muted">
              <Menu size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
