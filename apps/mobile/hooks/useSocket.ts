import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

function useSocket(url: string) {
  console.log('init useSocket');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(url);

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [url]);

  return socketRef;
}

export default useSocket;
