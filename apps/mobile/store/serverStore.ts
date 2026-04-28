import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebDavServer, P2pConnection } from "react-native-webdav-server";
import {
    DEFAULT_PORT,
    DEFAULT_BASE_PATH,
    DEFAULT_USERNAME,
    DEFAULT_PASSWORD,
} from "@/constants";

export type Settings = {
    port: number;
    basePath: string;
    authEnabled: boolean;
    username: string;
    password: string;
};

type ServerState = {
    // ip/port are legacy, will eventually remove
    ip: string | null;
    isRunning: boolean;
    settings: Settings;
    session_id: string | null;
    setSettings: (patch: Partial<Settings>) => void;
    setSessionId: (sessionId: string | null) => void;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    startWebDav: () => Promise<void>;
    stopWebDav: () => Promise<void>;
};

// Held outside Zustand; avoid serialization issues for native/JS instances.
let serverRef: WebDavServer | null = null;
let p2pConn: any = null;

const DEFAULT_SETTINGS: Settings = {
    port: DEFAULT_PORT,
    basePath: DEFAULT_BASE_PATH,
    authEnabled: true,
    username: DEFAULT_USERNAME,
    password: DEFAULT_PASSWORD,
};

//const SIGNAL_ENDPOINT =
//"https://vhlkksm25fy4nvj3zz4ruoao7i0ewjoa.lambda-url.ap-south-1.on.aws"; // HARDCODED as requested (replace as needed)
const SIGNAL_ENDPOINT = "http://192.168.29.216:9000"; // HARDCODED as requested (replace as needed)

export const useServerStore = create<ServerState>()(
    persist(
        (set, get) => ({
            ip: null,
            isRunning: false,
            settings: DEFAULT_SETTINGS,
            session_id: null,

            setSettings: (patch: Partial<Settings>) => {
                set((s) => ({ settings: { ...s.settings, ...patch } }));
            },

            setSessionId: (sessionId: string | null) => {
                set({ session_id: sessionId });
            },

            start: async () => {
                // Use session_id for P2pConnection
                const state = get();
                if (state.isRunning || !state.session_id) return;
                if (p2pConn) p2pConn.stop();
                try {
                    p2pConn = new P2pConnection();
                    console.log(SIGNAL_ENDPOINT);
                    console.log(state.settings.basePath);
                    console.log(state.session_id);
                    await p2pConn.start({
                        signallingEndpoint: SIGNAL_ENDPOINT,
                        basePath: state.settings.basePath,
                        sessionId: state.session_id,
                    });
                    set({ isRunning: true });
                } catch (e) {
                    console.error("Failed to start P2P connection", e);
                    set({ isRunning: false });
                    throw e;
                }
            },

            stop: async () => {
                if (!p2pConn) return;
                try {
                    await p2pConn.stop();
                } catch (e) {
                    console.error("Failed to stop P2P connection", e);
                }
                p2pConn = null;
                set({ isRunning: false });
            },

            startWebDav: async () => {
                const state = get();
                if (state.isRunning) return;
                if (!serverRef) {
                    serverRef = new WebDavServer();
                }
                try {
                    const opts: Parameters<WebDavServer["start"]>[0] = {
                        port: state.settings.port,
                        basePath: state.settings.basePath,
                    };
                    if (state.settings.authEnabled) {
                        opts.auth = {
                            username: state.settings.username,
                            password: state.settings.password,
                        };
                    }
                    const result = serverRef.start(opts);
                    set({
                        ip: result?.ip ?? null,
                        isRunning: true,
                    });
                } catch (e) {
                    console.error("Failed to start WebDAV server", e);
                    set({ isRunning: false, ip: null });
                    throw e;
                }
            },

            stopWebDav: async () => {
                const state = get();
                if (!serverRef || !state.isRunning) return;
                try {
                    serverRef.stop();
                    set({ isRunning: false, ip: null });
                } catch (e) {
                    console.error("Failed to stop WebDAV server", e);
                    throw e;
                }
            },
        }),
        {
            name: "server-storage",
            storage: createJSONStorage(() => AsyncStorage),
            // Only persist user-configurable settings, not transient runtime state.
            partialize: (state) => ({ settings: state.settings }),
        },
    ),
);

export { DEFAULT_SETTINGS };
// Expose for debugging (legacy)
export const _serverRef = () => serverRef;
export const _p2pConn = () => p2pConn;
