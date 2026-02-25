import {ChevronLeft, ChevronRight, Layers, Library, Music, PlusCircle, Settings, Sparkles} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {useAppStore} from "../stores/appStore";
import type {PageId} from "../types";

const navItems: { id: PageId; labelKey: string; icon: typeof Music }[] = [
    {id: "create", labelKey: "sidebar.create", icon: PlusCircle},
    {id: "library", labelKey: "sidebar.library", icon: Library},
    {id: "providers", labelKey: "sidebar.providers", icon: Layers},
    {id: "settings", labelKey: "sidebar.settings", icon: Settings},
];

export default function Sidebar() {
    const {currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar} =
        useAppStore();
    const {t} = useTranslation();

    return (
        <aside
            className={`
        flex flex-col bg-white border-r border-border
        transition-[width] duration-300 ease-in-out overflow-hidden
        ${sidebarCollapsed ? "w-16" : "w-56"}
      `}
        >
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-4 h-14
                      border-b border-border flex-shrink-0">
                <div
                    className="w-7 h-7 rounded-md bg-gradient-to-br
                      from-primary-500 to-primary-700
                      flex items-center justify-center
                      shadow-sm flex-shrink-0"
                >
                    <Music className="w-3.5 h-3.5 text-white"/>
                </div>
                <AnimatePresence>
                    {!sidebarCollapsed && (
                        <motion.span
                            initial={{opacity: 0, width: 0}}
                            animate={{opacity: 1, width: "auto"}}
                            exit={{opacity: 0, width: 0}}
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
            transition-colors duration-200 cursor-pointer
            ${sidebarCollapsed ? "px-2 py-2" : "px-3 py-2.5"}
          `}
                    title={t("sidebar.newCreation")}
                >
                    <Sparkles className="w-4 h-4 flex-shrink-0"/>
                    <AnimatePresence>
                        {!sidebarCollapsed && (
                            <motion.span
                                initial={{opacity: 0, width: 0}}
                                animate={{opacity: 1, width: "auto"}}
                                exit={{opacity: 0, width: 0}}
                                className="whitespace-nowrap overflow-hidden"
                            >
                                {t("sidebar.newCreation")}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 px-2 space-y-0.5">
                {navItems.map(({id, labelKey, icon: Icon}) => {
                    const active = currentPage === id || (id === "library" && currentPage === "detail");
                    const label = t(labelKey);
                    return (
                        <button
                            key={id}
                            onClick={() => setCurrentPage(id)}
                            title={sidebarCollapsed ? label : undefined}
                            className={`
                w-full flex items-center gap-2.5 px-3 py-2
                rounded-lg text-sm font-medium relative
                transition-colors duration-150 cursor-pointer
                ${
                                active
                                    ? "text-primary-700"
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
                                        initial={{opacity: 0, width: 0}}
                                        animate={{opacity: 1, width: "auto"}}
                                        exit={{opacity: 0, width: 0}}
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
                <div className="flex items-center justify-between">
                    <AnimatePresence>
                        {!sidebarCollapsed && (
                            <motion.p
                                initial={{opacity: 0}}
                                animate={{opacity: 1}}
                                exit={{opacity: 0}}
                                className="text-[10px] text-text-tertiary"
                            >
                                v0.1.0
                            </motion.p>
                        )}
                    </AnimatePresence>
                    <button
                        onClick={toggleSidebar}
                        className="p-1.5 rounded-lg hover:bg-surface-tertiary
                            text-text-tertiary hover:text-text-secondary
                            transition-colors cursor-pointer ml-auto"
                        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {sidebarCollapsed ? (
                            <ChevronRight className="w-4 h-4"/>
                        ) : (
                            <ChevronLeft className="w-4 h-4"/>
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
}