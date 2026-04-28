import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { QrCode } from 'lucide-react-native';
import { interopIcon } from '@/utils/css';

interopIcon(QrCode);

interface ConnectionInfoProps {
  isRunning: boolean;
  onPairDevice: () => void;
}

export default function ConnectionInfo({ isRunning, onPairDevice }: ConnectionInfoProps) {
  return (
    <View className="px-6">
      <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
        How to connect
      </Text>
      <View className="rounded-xl border border-border/50 bg-muted/30 p-4">
        <Text className="text-sm leading-relaxed text-muted-foreground">
          {'1. Tap “Start sharing” below.'}\n
          {'2. Tap “Pair device” below and scan the code from your other device.'}
        </Text>
        {isRunning && (
          <TouchableOpacity
            onPress={onPairDevice}
            className="mt-3 w-full flex-row items-center justify-center gap-3 rounded-xl border border-primary py-4">
            <QrCode className="text-primary" size={20} />
            <Text className="text-lg font-semibold text-primary">Pair device</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
