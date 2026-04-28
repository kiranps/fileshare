import { CameraView, useCameraPermissions } from 'expo-camera';
import { useServerStore } from '@/store/serverStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { View, Text, Button } from 'react-native';

interface QRScannerProps {
  onScanComplete?: () => void;
}

export default function QRScanner({ onScanComplete }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const setSessionId = useServerStore((s) => s.setSessionId);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      console.log('QR scanned (session_id):', data);
      setScanned(true);
      setSessionId(data);
      onScanComplete?.();
    },
    [setSessionId, onScanComplete]
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
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
        {scanned && <Button title="Scan Again" onPress={() => setScanned(false)} />}
      </View>
    </SafeAreaView>
  );
}
