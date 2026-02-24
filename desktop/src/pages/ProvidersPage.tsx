import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {useProviderStore} from "../stores/providerStore";
import {TABS} from "../constants/providerOptions";
import {LLMTab} from "./providers/LLMTab";
import {MusicTab} from "./providers/MusicTab";

export default function ProvidersPage() {
    const {t} = useTranslation();
    const {activeTab, setActiveTab} = useProviderStore();

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
                        {t("providers.title")}
                    </h1>
                    <p className="text-[13px] text-text-tertiary mt-1">
                        {t("providers.subtitle")}
                    </p>
                </div>

                {/* Tab bar */}
                <div className="flex bg-surface-secondary rounded-xl p-1 mb-6 relative">
                    {TABS.map(({id, labelKey, icon: Icon}) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4
                         rounded-lg text-sm font-medium transition-colors relative z-10
                         cursor-pointer ${
                                activeTab === id
                                    ? "text-primary-700"
                                    : "text-text-tertiary hover:text-text-secondary"
                            }`}
                        >
                            {activeTab === id && (
                                <motion.div
                                    layoutId="provider-tab-bg"
                                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                                    transition={{type: "spring", duration: 0.35, bounce: 0.15}}
                                />
                            )}
                            <Icon className="w-4 h-4 relative z-10"/>
                            <span className="relative z-10">{t(labelKey)}</span>
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{opacity: 0, y: 6}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -6}}
                        transition={{duration: 0.15}}
                    >
                        {activeTab === "llm" && <LLMTab/>}
                        {activeTab === "music" && <MusicTab/>}
                    </motion.div>
                </AnimatePresence>

                {/* Bottom spacer for player clearance */}
                <div className="h-20"/>
            </div>
        </div>
    );
}
