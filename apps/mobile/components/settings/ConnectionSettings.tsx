import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Folder } from 'lucide-react-native';
import { interopIcon } from '@/utils/css';
import type { Settings } from '@/store/serverStore';

interopIcon(Folder);

interface ConnectionSettingsProps {
  settings: Pick<Settings, 'port' | 'basePath'>;
  onChangeSettings: (patch: Partial<Settings>) => void;
  onBrowseFolder: () => void;
}

export default function ConnectionSettings({
  settings,
  onChangeSettings,
  onBrowseFolder,
}: ConnectionSettingsProps) {
  return (
    <View className="mb-6 px-6">
      <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
        Connection
      </Text>
      <View className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Port */}
        <View className="border-b border-border p-4">
          <Text className="mb-2 text-sm text-muted-foreground">Server Port</Text>
          <TextInput
            value={settings.port?.toString() ?? ''}
            onChangeText={(v) => {
              if (/^\d*$/.test(v)) {
                onChangeSettings({ port: v === '' ? undefined : Number(v) });
              }
            }}
            keyboardType="number-pad"
            className="rounded-lg border border-border bg-input px-4 py-3 font-mono text-foreground"
          />
          <Text className="mt-2 text-xs text-muted-foreground">
            Port must be between 1 and 65535
          </Text>
        </View>

        {/* Root Path */}
        <View className="p-4">
          <Text className="mb-2 text-sm text-muted-foreground">Root Filesystem Path</Text>
          <TouchableOpacity onPress={onBrowseFolder} className="flex-row gap-2">
            <TextInput
              value={settings.basePath}
              editable={false}
              placeholder="/storage/emulated/0"
              className="flex-1 rounded-lg border border-border bg-input px-4 py-3 font-mono text-foreground"
            />
            <View className="flex items-center justify-center rounded-lg border border-border bg-secondary px-4">
              <Folder className="text-secondary-foreground" size={20} />
            </View>
          </TouchableOpacity>
          <Text className="mt-2 text-xs text-muted-foreground">
            The folder that will be accessible to connected devices
          </Text>
        </View>
      </View>
    </View>
  );
}
