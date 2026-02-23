import { Music, PlusCircle, Clock, Settings } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import type { PageId } from "../types";

const navItems: { id: PageId; label: string; icon: typeof Music }[] = [
  { id: "create", label: "Create", icon: PlusCircle },
  { id: "history", label: "History", icon: Clock },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed } =
    useAppStore();

  return (
    <aside
      className={`
        flex flex-col bg-white border-r border-border
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? "w-16" : "w-56"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14
                      border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br
                        from-primary-500 to-primary-700
                        flex items-center justify-center
                        shadow-sm">
          <Music className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="font-semibold text-sm
                           text-text-primary tracking-tight">
            HikariWave
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2
                rounded-lg text-sm font-medium
                transition-all duration-150 cursor-pointer
                ${
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                }
              `}
            >
              <Icon
                className={`w-4.5 h-4.5 flex-shrink-0 ${
                  active
                    ? "text-primary-600"
                    : "text-text-tertiary"
                }`}
              />
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border">
        {!sidebarCollapsed && (
          <p className="text-[10px] text-text-tertiary
                        text-center">
            v0.1.0
          </p>
        )}
      </div>
    </aside>
  );
}
