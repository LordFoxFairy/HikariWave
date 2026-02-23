import Sidebar from "./components/Sidebar";
import Player from "./components/Player";
import CreatePage from "./pages/CreatePage";
import LibraryPage from "./pages/LibraryPage";
import HistoryPage from "./pages/HistoryPage";
import ProvidersPage from "./pages/ProvidersPage";
import SettingsPage from "./pages/SettingsPage";
import { useAppStore } from "./stores/appStore";

function PageRouter() {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {currentPage === "create" && <CreatePage />}
      {currentPage === "library" && <LibraryPage />}
      {currentPage === "history" && <HistoryPage />}
      {currentPage === "providers" && <ProvidersPage />}
      {currentPage === "settings" && <SettingsPage />}
    </div>
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
