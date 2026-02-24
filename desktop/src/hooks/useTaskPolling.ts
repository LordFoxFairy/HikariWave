import type {RefObject} from "react";
import {useCallback, useEffect, useRef, useState} from "react";
import {api} from "../services/api";
import {useCreateStore} from "../stores/createStore";
import {useTranslation} from "react-i18next";

interface UseTaskPollingOptions {
    resultRef: RefObject<HTMLDivElement | null>;
}

export function useTaskPolling({resultRef}: UseTaskPollingOptions) {
    const store = useCreateStore();
    const {t} = useTranslation();
    const [progressMessage, setProgressMessage] = useState("");
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    const pollTask = useCallback((taskId: string) => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        const interval = setInterval(async () => {
            try {
                const gen = await api.getTaskStatus(taskId);
                store.setProgress(gen.progress ?? 0);
                setProgressMessage(gen.progress_message || "");
                if (gen.status === "completed") {
                    if (gen.lyrics) store.setLyrics(gen.lyrics);
                    if (gen.title) store.setTitle(gen.title);
                    store.setGenerationStatus("completed");
                    store.setSuccessMessage(t("create.musicGeneratedSuccess"));
                    setProgressMessage("");
                    clearInterval(interval);
                    pollIntervalRef.current = null;
                    setTimeout(() => resultRef.current?.scrollIntoView({behavior: "smooth"}), 200);
                } else if (gen.status === "failed") {
                    store.setGenerationStatus("failed");
                    store.setErrorMessage(gen.error_message || "Generation failed.");
                    setProgressMessage("");
                    clearInterval(interval);
                    pollIntervalRef.current = null;
                }
            } catch {
                clearInterval(interval);
                pollIntervalRef.current = null;
                store.setGenerationStatus("failed");
                store.setErrorMessage(t("create.lostConnection"));
                setProgressMessage("");
            }
        }, 2000);
        pollIntervalRef.current = interval;
    }, [store, t, resultRef]);

    const cancelPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        setProgressMessage("");
    }, []);

    return {pollTask, cancelPolling, progressMessage, setProgressMessage};
}
