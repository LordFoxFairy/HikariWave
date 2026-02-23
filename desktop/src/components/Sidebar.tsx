import { Music, PlusCircle, Clock, Settings, Sparkles, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../stores/appStore";
import type { PageId } from "../types";

const navItems: { id: PageId; label: string; icon: typeof Music }[] = [
  { id: "create", label: "Create", icon: PlusCircle },
  { id: "history", label: "History", icon: Clock },
  { id: "providers", label: "Providers", icon: Layers },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed } =
    useAppStore();

  return (
    <aside
      className={`
        flex flex-col bg-white border-r border-border
        transition-all duration-300 ease-in-out overflow-hidden
        ${sidebarCollapsed ? "w-16" : "w-56"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14
                      border-b border-border flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg bg-gradient-to-br
                      from-primary-500 to-primary-700
                      flex items-center justify-center
                      shadow-sm flex-shrink-0"
        >
          <Music className="w-4 h-4 text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="font-semibold text-sm text-text-primary
                         tracking-tight whitespace-nowrap overflow-hidden"
            >
              HikariWave
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* New Creation quick-action */}
      <div className="px-2 pt-3 pb-1 flex-shrink-0">
        <button
          onClick={() => setCurrentPage("create")}
          className={`
            w-full flex items-center justify-center gap-2
            rounded-lg font-medium text-sm
            bg-gradient-to-r from-primary-600 to-primary-700
            text-white shadow-sm
            hover:from-primary-700 hover:to-primary-800
            transition-all duration-200 cursor-pointer
            ${sidebarCollapsed ? "px-2 py-2" : "px-3 py-2.5"}
          `}
          title="New Creation"
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="whitespace-nowrap overflow-hidden"
              >
                New Creation
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              title={sidebarCollapsed ? label : undefined}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2
                rounded-lg text-sm font-medium relative
                transition-all duration-150 cursor-pointer
                ${
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                }
              `}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary-50 rounded-lg z-0"
                  transition={{
                    type: "spring",
                    duration: 0.35,
                    bounce: 0.15,
                  }}
                />
              )}
              <Icon
                className={`w-4.5 h-4.5 flex-shrink-0 relative z-10
                  ${active ? "text-primary-600" : "text-text-tertiary"}`}
              />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="relative z-10 whitespace-nowrap
                               overflow-hidden"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border flex-shrink-0">
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-text-tertiary text-center"
            >
              v0.1.0
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}