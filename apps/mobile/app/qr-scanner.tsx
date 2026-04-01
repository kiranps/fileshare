import { useRouter } from 'expo-router';
import QRScanner from '@/components/QRScanner';

export default function QRScannerScreen() {
  const router = useRouter();

  return <QRScanner onScanComplete={() => router.back()} />;
}
