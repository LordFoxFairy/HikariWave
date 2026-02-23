import {useCallback, useEffect, useState} from "react";
import {Globe, Info, Loader2, Music, Server,} from "lucide-react";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {useSettingsStore} from "../stores/settingsStore";
import {api} from "../services/api";

const LOCALE_OPTIONS = [
    {value: "zh-CN", labelKey: "settings.chinese"},
    {value: "en", labelKey: "settings.english"},
];

export default function SettingsPage() {
    const {backendUrl, setBackendUrl, locale, setLocale} = useSettingsStore();
    const {t} = useTranslation();

    const [healthOk, setHealthOk] = useState<boolean | null>(null);
    const [testing, setTesting] = useState(false);

    const loadData = useCallback(async () => {
        try {
            await api.healthCheck();
            setHealthOk(true);
        } catch {
            setHealthOk(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
                    <h1 className="text-[22px] font-bold text-text-primary tracking-tight">{t("settings.title")}</h1>
                    <p className="text-[13px] text-text-tertiary mt-1">
                        {t("settings.subtitle")}
                    </p>
                </div>

                {/* ---- Language Section ---- */}
                <SectionHeader icon={Globe} title={t("settings.language")}/>
                <motion.div
                    initial={{opacity: 0, y: 8}}
                    animate={{opacity: 1, y: 0}}
                    className="bg-white rounded-xl border border-border shadow-sm p-5"
                >
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                        {t("settings.languageDesc")}
                    </label>
                    <div className="flex gap-2">
                        {LOCALE_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setLocale(opt.value)}
                                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium
                           transition-all cursor-pointer ${
                                    (locale || "zh-CN") === opt.value
                                        ? "border-primary-400 bg-primary-50 text-primary-700 shadow-sm"
                                        : "border-border text-text-secondary hover:bg-surface-secondary hover:border-primary-200"
                                }`}
                            >
                                {t(opt.labelKey)}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* ---- Connection Section ---- */}
                <SectionHeader icon={Server} title={t("settings.backendConnection")} status={healthOk}/>
                <motion.div
                    initial={{opacity: 0, y: 8}}
                    animate={{opacity: 1, y: 0}}
                    className="bg-white rounded-xl border border-border shadow-sm p-5"
                >
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                        {t("settings.apiBaseUrl")}
                    </label>
                    <div className="flex gap-2">
                        <input
                            value={backendUrl}
                            onChange={(e) => setBackendUrl(e.target.value)}
                            className="flex-1 px-3.5 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300
                         focus:border-primary-400"
                        />
                        <button
                            onClick={checkHealth}
                            disabled={testing}
                            className="px-4 py-2 rounded-lg bg-primary-50 text-primary-700
                         text-sm font-medium hover:bg-primary-100
                         transition-colors cursor-pointer disabled:opacity-50
                         flex items-center gap-1.5"
                        >
                            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                            {t("settings.testConnection")}
                        </button>
                    </div>
                    {healthOk !== null && (
                        <p className={`text-xs mt-2 ${healthOk ? "text-green-600" : "text-red-500"}`}>
                            {healthOk
                                ? t("settings.connectedSuccess")
                                : t("settings.connectionFailed")}
                        </p>
                    )}
                </motion.div>

                {/* ---- About Section ---- */}
                <SectionHeader icon={Info} title={t("settings.about")}/>
                <motion.div
                    initial={{opacity: 0, y: 8}}
                    animate={{opacity: 1, y: 0}}
                    transition={{delay: 0.05}}
                    className="bg-white rounded-xl border border-border shadow-sm p-5"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div
                            className="w-10 h-10 rounded-xl bg-gradient-to-br
                          from-primary-500 to-primary-700
                          flex items-center justify-center"
                        >
                            <Music className="w-5 h-5 text-white"/>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-text-primary">HikariWave</p>
                            <p className="text-xs text-text-tertiary">v0.1.0</p>
                        </div>
                    </div>
                    <p className="text-xs text-text-tertiary leading-relaxed">
                        {t("settings.aboutDesc")}
                    </p>
                </motion.div>

                {/* Bottom spacer for player clearance */}
                <div className="h-20"/>
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
    const {t} = useTranslation();
    return (
        <div className="flex items-center gap-2 pt-2">
            <Icon className="w-4 h-4 text-primary-600"/>
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            {status === true && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
                    {t("settings.connected")}
        </span>
            )}
            {status === false && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-red-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"/>
                    {t("settings.disconnected")}
        </span>
            )}
        </div>
    );
}
