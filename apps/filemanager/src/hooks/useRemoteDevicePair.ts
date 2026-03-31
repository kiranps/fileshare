import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type PairingData = {
	to: string;
	msg: string;
};

interface RemoteDeviceInfo {
	ip: string;
	port: string;
	[key: string]: any;
}

interface UseRemoteDevicePairResult {
	message: RemoteDeviceInfo | null;
}

// Endpoint example: /api/pair/socket
const SOCKET_ENDPOINT = "http://localhost:5050";

export function useRemoteDevicePair(id: string): UseRemoteDevicePairResult {
	const [message, setMessage] = useState<RemoteDeviceInfo | null>(null);
	const socketRef = useRef<Socket | null>(null);

	useEffect(() => {
		let active = true;
		setMessage(null);

		const socket = io(SOCKET_ENDPOINT, {
			query: {
				user_id: id,
			},
		});
		socketRef.current = socket;

		socket.on("connect", () => {
			console.log("connected", socket.id);
		});

		// Listen for device pairing event
		const handlePairing = (data: PairingData) => {
			const ip_port: RemoteDeviceInfo = JSON.parse(data.msg);
			if (!active) return;
			setMessage(ip_port);
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
		};

		socket.on("private_message", handlePairing);

		return () => {
			active = false;
			socket.off("private_message", handlePairing);
			socket.disconnect();
			socketRef.current = null;
		};
	}, [id]);

	return { message };
}
