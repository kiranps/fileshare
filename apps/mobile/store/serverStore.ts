import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebDavServer } from 'react-native-webdav-server';
import { DEFAULT_PORT, DEFAULT_BASE_PATH, DEFAULT_USERNAME, DEFAULT_PASSWORD } from '@/constants';

export type Settings = {
  port: number;
  basePath: string;
  authEnabled: boolean;
  username: string;
  password: string;
};

type ServerState = {
  ip: string | null;
  isRunning: boolean;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

// Held outside Zustand to avoid serialization issues with the native server instance.
let serverRef: WebDavServer | null = null;

const DEFAULT_SETTINGS: Settings = {
  port: DEFAULT_PORT,
  basePath: DEFAULT_BASE_PATH,
  authEnabled: true,
  username: DEFAULT_USERNAME,
  password: DEFAULT_PASSWORD,
};

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      ip: null,
      isRunning: false,
      settings: DEFAULT_SETTINGS,

      setSettings: (patch: Partial<Settings>) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      start: async () => {
        const state = get();
        if (state.isRunning) return;

        if (!serverRef) {
          serverRef = new WebDavServer();
        }

        try {
          const opts: Parameters<WebDavServer['start']>[0] = {
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
          console.error('Failed to start WebDAV server', e);
          set({ isRunning: false, ip: null });
          throw e;
        }
      },

      stop: async () => {
        const state = get();
        if (!serverRef || !state.isRunning) return;

        try {
          serverRef.stop();
          set({ isRunning: false, ip: null });
        } catch (e) {
          console.error('Failed to stop WebDAV server', e);
          throw e;
        }
      },
    }),
    {
      name: 'server-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user-configurable settings, not transient runtime state.
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

export { DEFAULT_SETTINGS };

// Expose serverRef for debugging purposes only — do not use in production code.
export const _serverRef = () => serverRef;
