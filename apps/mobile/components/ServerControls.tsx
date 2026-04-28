import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Server as ServerIcon, CheckCircle2, XCircle, Play, Square } from 'lucide-react-native';
import { interopIcon } from '@/utils/css';

interopIcon(ServerIcon);
interopIcon(CheckCircle2);
interopIcon(XCircle);
interopIcon(Play);
interopIcon(Square);

interface ServerControlsProps {
  isRunning: boolean;
  onToggle: () => void;
}

export default function ServerControls({ isRunning, onToggle }: ServerControlsProps) {
  return (
    <>
      {/* Status Card */}
      <View className="mx-6 mb-6">
        <View
          className={`rounded-2xl border p-6 ${isRunning ? 'border-primary/20 bg-primary/10' : 'border-border bg-muted/50'}`}>
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className={`rounded-full p-3 ${isRunning ? 'bg-primary' : 'bg-muted'}`}>
                <ServerIcon size={28} color={isRunning ? 'white' : 'gray'} />
              </View>
              <View>
                <Text
                  className={`text-lg font-semibold ${isRunning ? 'text-primary' : 'text-muted-foreground'}`}>
                  {isRunning ? 'Sharing active' : 'Not sharing'}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {isRunning ? 'P2P file sharing active' : 'Tap the button below to start sharing'}
                </Text>
              </View>
            </View>
            {isRunning ? (
              <CheckCircle2 className="text-primary" size={24} />
            ) : (
              <XCircle className="text-muted-foreground" size={24} />
            )}
          </View>
        </View>
      </View>
      {/* Fixed Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent p-6">
        <TouchableOpacity
          onPress={onToggle}
          className={`w-full flex-row items-center justify-center gap-3 rounded-xl py-4 ${isRunning ? 'bg-destructive' : 'bg-primary'}`}>
          {isRunning ? (
            <>
              <Square color="white" size={20} fill="white" />
              <Text className="text-lg font-semibold text-white">Stop sharing</Text>
            </>
          ) : (
            <>
              <Play color="white" size={20} fill="white" />
              <Text className="text-lg font-semibold text-white">Start sharing</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}
