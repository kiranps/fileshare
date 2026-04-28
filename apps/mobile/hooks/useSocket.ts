import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Returns a stable ref to a Socket.io connection for the given URL.
 *
 * A ref (rather than state) is intentional: connect/disconnect events should
 * not cause component re-renders. Callers that need reactive connection status
 * should listen to the socket events directly (e.g. `socket.current?.on('connect', ...)`).
 */
function useSocket(url: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(url);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('connected', socket.id);
    });

    return () => {
      socket.disconnect();
    };
  }, [url]);

  return socketRef;
}

export default useSocket;
