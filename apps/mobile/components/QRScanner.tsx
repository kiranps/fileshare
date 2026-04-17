import { CameraView, useCameraPermissions } from "expo-camera";
import { useServerStore } from "@/store/serverStore";
import { useShallow } from "zustand/react/shallow";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Button } from "react-native";
import useSocket from "@/hooks/useSocket";
import { RELAY_SERVER_URL } from "@/constants";

interface QRScannerProps {
    onScanComplete?: () => void;
}

export default function QRScanner({ onScanComplete }: QRScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [socketError, setSocketError] = useState<string | null>(null);
    console.log(RELAY_SERVER_URL);

    const socket = useSocket(RELAY_SERVER_URL);

    const { ip, port } = useServerStore(
        useShallow((s) => ({ ip: s.ip, port: s.settings.port })),
    );

    // Keep latest ip/port/onScanComplete in a ref so the barcode handler can
    // always read the current values without being a stale closure.
    const serverInfoRef = useRef({ ip, port, onScanComplete });
    useEffect(() => {
        serverInfoRef.current = { ip, port, onScanComplete };
    }, [ip, port, onScanComplete]);

    useEffect(() => {
        const sock = socket.current;
        if (!sock) return;

        const onConnect = () => {
            console.log("Connected to relay server:", sock.id);
            setSocketError(null);
        };
        const onConnectError = (err: Error) => {
            console.log(RELAY_SERVER_URL);
            console.error("Relay server connection error:", err.message);
            setSocketError(
                "Could not connect to relay server. Pairing may not work.",
            );
        };
        const onDisconnect = (reason: string) => {
            console.log("Disconnected from relay server:", reason);
        };

        //sock.on("connect", onConnect);
        sock.on("connect_error", onConnectError);
        sock.on("disconnect", onDisconnect);

        return () => {
            sock.off("connect", onConnect);
            sock.off("connect_error", onConnectError);
            sock.off("disconnect", onDisconnect);
        };
    }, [socket]);

    const handleBarcodeScanned = useCallback(
        ({ data }: { data: string }) => {
            console.log("QR scanned:", data);
            setScanned(true);

            socket.current?.emit("private_message", {
                to: data,
                msg: JSON.stringify({
                    ip: serverInfoRef.current.ip,
                    port: serverInfoRef.current.port,
                }),
            });

            serverInfoRef.current.onScanComplete?.();
        },
        [socket],
    );

    if (!permission) {
        return <Text>Requesting permission...</Text>;
    }

    if (!permission.granted) {
        return (
            <View>
                <Text>No camera access</Text>
                <Button title="Grant Permission" onPress={requestPermission} />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 px-4 pt-6">
                {socketError && (
                    <Text className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        {socketError}
                    </Text>
                )}
                <CameraView
                    style={{ flex: 1 }}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={
                        scanned ? undefined : handleBarcodeScanned
                    }
                />
                {scanned && (
                    <Button
                        title="Scan Again"
                        onPress={() => setScanned(false)}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}
