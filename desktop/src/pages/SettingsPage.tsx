import { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  Brain,
  CheckCircle,
  Loader2,
  Info,
  Music,
} from "lucide-react";
import { motion } from "framer-motion";
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
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
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
          setLlmProviders(Array.isArray(llm) ? llm : []);
          setMusicProviders(Array.isArray(music) ? music : []);
        }
      } catch {
        /* backend might not be running */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkHealth = async () => {
    setTesting(true);
    try {
      await api.healthCheck();
      setHealthOk(true);
    } catch {
      setHealthOk(false);
    } finally {
      setTesting(false);
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

        {/* ---- Connection Section ---- */}
        <SectionHeader
          icon={Server}
          title="Backend Connection"
          status={healthOk}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-border
                     shadow-sm p-5"
        >
          <label className="block text-xs font-medium
                            text-text-secondary mb-2">
            API Base URL
          </label>
          <div className="flex gap-2">
            <input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-lg border
                         border-border bg-surface-secondary text-sm
                         focus:outline-none focus:ring-2
                         focus:ring-primary-300
                         focus:border-primary-400"
            />
            <button
              onClick={checkHealth}
              disabled={testing}
              className="px-4 py-2 rounded-lg bg-primary-50
                         text-primary-700 text-sm font-medium
                         hover:bg-primary-100 transition-colors
                         cursor-pointer disabled:opacity-50
                         flex items-center gap-1.5"
            >
              {testing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Test Connection
            </button>
          </div>
          {healthOk !== null && (
            <p
              className={`text-xs mt-2 ${
                healthOk ? "text-green-600" : "text-red-500"
              }`}
            >
              {healthOk
                ? "Connected successfully"
                : "Connection failed -- check the URL and backend"}
            </p>
          )}
        </motion.div>

        {/* ---- LLM Provider Section ---- */}
        <SectionHeader icon={Brain} title="LLM Provider" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-xl border border-border
                     shadow-sm p-5"
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
              <span className="text-sm text-text-tertiary ml-2">Loading providers...</span>
            </div>
          ) : llmProviders.length > 0 ? (
            <div className="space-y-2">
              {llmProviders.map((p) => (
                <ProviderCard
                  key={p.name}
                  provider={p}
                  selected={llmProvider === p.name}
                  onSelect={() => setLlmProvider(p.name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              {healthOk === false
                ? "Backend not reachable -- check the URL and start the backend"
                : "Connect to backend to see providers"}
            </p>
          )}
        </motion.div>

        {/* ---- Music Provider Section ---- */}
        <SectionHeader icon={Cpu} title="Music Provider" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-border
                     shadow-sm p-5"
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
              <span className="text-sm text-text-tertiary ml-2">Loading providers...</span>
            </div>
          ) : musicProviders.length > 0 ? (
            <div className="space-y-2">
              {musicProviders.map((p) => (
                <ProviderCard
                  key={p.name}
                  provider={p}
                  selected={musicProvider === p.name}
                  onSelect={() => setMusicProvider(p.name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              {healthOk === false
                ? "Backend not reachable -- check the URL and start the backend"
                : "Connect to backend to see providers"}
            </p>
          )}
        </motion.div>

        {/* ---- About Section ---- */}
        <SectionHeader icon={Info} title="About" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-border
                     shadow-sm p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br
                            from-primary-500 to-primary-700
                            flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                HikariWave
              </p>
              <p className="text-xs text-text-tertiary">v0.1.0</p>
            </div>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">
            AI-powered music generation desktop app. Built with React,
            Tauri, and love for music.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function SectionHeader({
  icon: Icon,
  title,
  status,
}: {
  icon: typeof Server;
  title: string;
  status?: boolean | null;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="w-4 h-4 text-primary-600" />
      <h2 className="text-sm font-semibold text-text-primary">
        {title}
      </h2>
      {status === true && (
        <span className="ml-auto flex items-center gap-1 text-[11px]
                         text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Connected
        </span>
      )}
      {status === false && (
        <span className="ml-auto flex items-center gap-1 text-[11px]
                         text-red-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Disconnected
        </span>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: ProviderInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 rounded-lg border
                  text-sm transition-all cursor-pointer flex
                  items-center gap-3 ${
        selected
          ? "border-primary-300 bg-primary-50"
          : "border-border hover:bg-surface-secondary"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          provider.is_active ? "bg-green-500" : "bg-border"
        }`}
      />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{provider.name}</span>
        <p className="text-xs text-text-tertiary truncate mt-0.5">
          {(provider.models ?? []).join(", ") || "No models listed"}
        </p>
      </div>
      {selected && (
        <CheckCircle className="w-4 h-4 text-primary-600
                                flex-shrink-0" />
      )}
    </button>
  );
}
