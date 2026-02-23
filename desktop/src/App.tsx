import Sidebar from "./components/Sidebar";
import Player from "./components/Player";
import CreatePage from "./pages/CreatePage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import { useAppStore } from "./stores/appStore";

function PageRouter() {
  const currentPage = useAppStore((s) => s.currentPage);
  switch (currentPage) {
    case "create":
      return <CreatePage />;
    case "history":
      return <HistoryPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <CreatePage />;
  }
}

export default function App() {
  return (
    <div className="h-screen flex flex-col
                    bg-surface-secondary">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col
                         overflow-hidden">
          <PageRouter />
        </main>
      </div>
      <Player />
    </div>
  );
}
