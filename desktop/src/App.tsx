import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./components/Sidebar";
import Player from "./components/Player";
import CreatePage from "./pages/CreatePage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import { useAppStore } from "./stores/appStore";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function PageRouter() {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {currentPage === "create" && <CreatePage />}
        {currentPage === "history" && <HistoryPage />}
        {currentPage === "settings" && <SettingsPage />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-surface-secondary">
      {/* Top title bar area (Tauri window drag region) */}
      <div
        data-tauri-drag-region
        className="h-8 flex items-center px-4 bg-white
                   border-b border-border flex-shrink-0
                   select-none"
      >
        <span className="text-[11px] text-text-tertiary
                         font-medium tracking-wide uppercase">
          HikariWave
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <PageRouter />
        </main>
      </div>
      <Player />
    </div>
  );
}
