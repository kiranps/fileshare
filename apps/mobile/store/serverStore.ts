import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebDavServer } from 'react-native-webdav-server';

type Settings = {
  portSetting: string;
  basePath: string;
  authEnabled: boolean;
  username: string;
  password: string;
};

type ServerState = {
  ip: string | null;
  port: number | null;
  isRunning: boolean;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  start: (opts?: { port?: number; basePath?: string }) => Promise<void> | void;
  stop: () => Promise<void> | void;
};

let serverRef: WebDavServer | null = null;

const initializer = (set: any, get: any) => ({
  ip: null,
  port: null,
  isRunning: false,
  settings: {
    portSetting: '2121',
    basePath: '/storage/emulated/0',
    protocol: 'FTP',
    authEnabled: true,
    username: 'admin',
    password: 'password',
  },
  setSettings: (patch: Partial<Settings>) => {
    set((s: any) => ({ settings: { ...s.settings, ...patch } }));
  },
  start: async ({ port, basePath }: { port?: number; basePath?: string } = {}) => {
    const state = get() as ServerState;
    if (!serverRef) {
      serverRef = new WebDavServer();
      console.log('Initialised WebDavServer');
    }
    if (state.isRunning) return;

    try {
      const opts: any = {
        port: port ?? (Number(state.settings.portSetting) || undefined),
        basePath: basePath ?? state.settings.basePath,
      };
      if (state.settings.authEnabled) {
        opts.auth = { username: state.settings.username, password: state.settings.password };
      }

      const result = serverRef.start(opts);
      // react-native-webdav-server appears to return { ip, port }
      set({ ip: result?.ip ?? null, port: result?.port ?? null, isRunning: true });
    } catch (e) {
      console.error('Failed to start WebDAV server', e);
      throw e;
    }
  },
  stop: async () => {
    const state = get() as ServerState;
    if (!serverRef || !state.isRunning) return;
    try {
      serverRef.stop();
      set({ isRunning: false, ip: null, port: null });
    } catch (e) {
      console.error('Failed to stop WebDAV server', e);
      throw e;
    }
  },
});

const storage =
  typeof AsyncStorage !== 'undefined' ? createJSONStorage(() => AsyncStorage) : undefined;

const canPersist =
  typeof storage !== 'undefined' && !!(storage && typeof storage.setItem === 'function');

export const useServerStore = create<ServerState>()(
  persist(
    initializer as any,
    {
      name: 'server-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state: ServerState) => ({ settings: state.settings }),
    } as any
  )
);

// Expose serverRef for debugging if necessary
export const _serverRef = () => serverRef;
