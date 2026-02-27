import { useCallback, useEffect, useRef, useState } from 'react';
import { WebDavServer } from 'react-native-webdav-server';

type UseWebDavServerReturn = {
  ip: string | null;
  port: number | null;
  isRunning: boolean;
  start: (params: { port?: number; basePath: string }) => void;
  stop: () => void;
};

export function useWebDavServer(): UseWebDavServerReturn {
  const serverRef = useRef<WebDavServer | null>(null);

  const [ip, setIp] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Ensure server is created only once
  if (!serverRef.current) {
    serverRef.current = new WebDavServer();
    console.log('Initialised WebDavServer');
  }

  const start = useCallback(
    ({ port, basePath }: { port?: number; basePath: string }) => {
      if (!serverRef.current || isRunning) return;

      const opts = {
        port,
        basePath,
        auth: {
          username: 'kiran',
          password: 'password',
        },
      };

      try {
        const result = serverRef.current.start(opts);
        setIp(result.ip);
        setPort(result.port); // use returned port
        setIsRunning(true);
      } catch (error) {
        console.error('Failed to start WebDAV server:', error);
      }
    },
    [isRunning]
  );

  const stop = useCallback(() => {
    if (!serverRef.current || !isRunning) return;

    try {
      serverRef.current.stop();
      setIsRunning(false);
      setIp(null);
    } catch (error) {
      console.error('Failed to stop WebDAV server:', error);
    }
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serverRef.current && isRunning) {
        try {
          serverRef.current.stop();
        } catch {}
      }
    };
  }, [isRunning]);

  return {
    ip,
    port,
    isRunning,
    start,
    stop,
  };
}
