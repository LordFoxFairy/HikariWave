import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import {setBaseUrl} from "./services/api";
import {useSettingsStore} from "./stores/settingsStore";

// Eagerly initialize the API base URL from persisted settings.
// The persist middleware also calls setBaseUrl via onRehydrateStorage,
// but we do it here too to cover the synchronous localStorage read path.
const {backendUrl} = useSettingsStore.getState();
if (backendUrl) {
    setBaseUrl(backendUrl);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>,
);
