import { CameraView, useCameraPermissions } from "expo-camera";
import { useServerStore } from "@/store/serverStore";
import { useShallow } from "zustand/react/shallow";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import useSocket from "../hooks/useSocket";

interface QRScannerProps {
    onScanComplete?: () => void;
}

export default function QRScanner({ onScanComplete }: QRScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [scanned_data, setScannedData] = useState<string | null>(null);
    const socket = useSocket("http://192.168.29.216:5050");

    const { ip, port } = useServerStore(
        useShallow((s) => ({ ip: s.ip, port: s.settings.port })),
    );

    useEffect(() => {
        socket.current?.on("connect", () => {
            console.log("Connected:", socket.current?.id);
        });

        socket.current?.on("disconnect", (reason) => {
            console.log("Disconnected:", reason);
        });
    }, []);

    useEffect(() => {
        const run = () => {
            socket.current?.emit("private_message", {
                to: scanned_data,
                msg: JSON.stringify({ ip, port }),
            });
        };

        if (scanned) {
            run();
            onScanComplete?.();
        }
    }, [scanned_data]);

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
                <CameraView
                    style={{ flex: 1 }}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                    onBarcodeScanned={
                        scanned
                            ? undefined
                            : ({ data }) => {
                                  console.log(data);
                                  setScannedData(data);
                                  setScanned(true);
                              }
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
