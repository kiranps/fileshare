import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import useSocket from '../hooks/useSocket';
import * as Network from 'expo-network';

interface QRScannerProps {
  onScanComplete?: () => void;
}

export default function QRScanner({ onScanComplete }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanned_data, setScannedData] = useState<string | null>(null);
  const socket = useSocket('http://192.168.29.216:5050');

  useEffect(() => {
    socket.current?.on('connect', () => {
      console.log('Connected:', socket.current?.id);
    });

    socket.current?.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });
  }, []);

  useEffect(() => {
    const run = async () => {
      const ip = await Network.getIpAddressAsync();

      console.log(scanned_data);
      console.log(ip);

      socket.current?.emit('private_message', {
        to: scanned_data,
        msg: ip,
      });
    };

    if (scanned) {
      run().then(() => {
        onScanComplete?.();
      });
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
            barcodeTypes: ['qr'],
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

        {scanned && <Button title="Scan Again" onPress={() => setScanned(false)} />}
      </View>
    </SafeAreaView>
  );
}
