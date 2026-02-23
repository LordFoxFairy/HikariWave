import { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  Brain,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { api } from "../services/api";
import type { ProviderInfo } from "../types";

export default function SettingsPage() {
  const {
    backendUrl,
    llmProvider,
    musicProvider,
    setBackendUrl,
    setLlmProvider,
    setMusicProvider,
  } = useSettingsStore();

  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [llmProviders, setLlmProviders] = useState<ProviderInfo[]>(
    [],
  );
  const [musicProviders, setMusicProviders] = useState<
    ProviderInfo[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.healthCheck();
        if (!cancelled) setHealthOk(true);
      } catch {
        if (!cancelled) setHealthOk(false);
      }
      try {
        const [llm, music] = await Promise.all([
          api.getProviders("llm"),
          api.getProviders("music"),
        ]);
        if (!cancelled) {
          setLlmProviders(llm);
          setMusicProviders(music);
        }
      } catch {
        /* backend might not be running */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const checkHealth = async () => {
    try {
      await api.healthCheck();
      setHealthOk(true);
    } catch {
      setHealthOk(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Settings
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure your HikariWave instance
          </p>
        </div>

        {/* Backend URL */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4.5 h-4.5 text-primary-600" />
            <h2 className="text-sm font-semibold text-text-primary">
              Backend Connection
            </h2>
            {healthOk === true && (
              <CheckCircle className="w-4 h-4 text-green-500
                                      ml-auto" />
            )}
            {healthOk === false && (
              <XCircle className="w-4 h-4 text-red-400 ml-auto" />
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-lg
                         border border-border bg-surface-secondary
                         text-sm focus:outline-none focus:ring-2
                         focus:ring-primary-300
                         focus:border-primary-400"
            />
            <button
              onClick={checkHealth}
              className="px-4 py-2 rounded-lg bg-primary-50
                         text-primary-700 text-sm font-medium
                         hover:bg-primary-100 transition-colors
                         cursor-pointer"
            >
              Test
            </button>
          </div>
        </div>

        {/* LLM Provider */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4.5 h-4.5 text-primary-600" />
            <h2 className="text-sm font-semibold text-text-primary">
              LLM Provider
            </h2>
          </div>
          {llmProviders.length > 0 ? (
            <div className="space-y-2">
              {llmProviders.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setLlmProvider(p.name)}
                  className={`w-full text-left px-4 py-3
                    rounded-lg border text-sm transition-all
                    cursor-pointer ${
                      llmProvider === p.name
                        ? "border-primary-300 bg-primary-50"
                        : "border-border hover:bg-surface-secondary"
                    }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-text-tertiary ml-2">
                    {p.models.join(", ")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              Connect to backend to see providers
            </p>
          )}
        </div>

        {/* Music Provider */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4.5 h-4.5 text-primary-600" />
            <h2 className="text-sm font-semibold text-text-primary">
              Music Provider
            </h2>
          </div>
          {musicProviders.length > 0 ? (
            <div className="space-y-2">
              {musicProviders.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setMusicProvider(p.name)}
                  className={`w-full text-left px-4 py-3
                    rounded-lg border text-sm transition-all
                    cursor-pointer ${
                      musicProvider === p.name
                        ? "border-primary-300 bg-primary-50"
                        : "border-border hover:bg-surface-secondary"
                    }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-text-tertiary ml-2">
                    {p.models.join(", ")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              Connect to backend to see providers
            </p>
          )}
        </div>
      </div>
    </div>
  );
}