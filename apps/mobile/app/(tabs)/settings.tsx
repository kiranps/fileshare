import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react-native';
import { interopIcon } from '@/utils/css';
import { useServerStore, DEFAULT_SETTINGS } from '@/store/serverStore';
import { useShallow } from 'zustand/react/shallow';
import FileBrowser from '@/components/FileBrowser';
import ConnectionSettings from '@/components/settings/ConnectionSettings';
import AuthSettings from '@/components/settings/AuthSettings';

interopIcon(SettingsIcon);
interopIcon(Save);
interopIcon(RefreshCw);

export default function SettingsScreen() {
  const { settings, setSettings } = useServerStore(
    useShallow((s) => ({
      settings: s.settings,
      setSettings: s.setSettings,
    }))
  );

  const [showFileBrowser, setShowFileBrowser] = useState(false);

  const handleSave = () => {
    if (isNaN(settings.port) || settings.port < 1 || settings.port > 65535) {
      Alert.alert('Invalid Port', 'Please enter a valid port number (1-65535)');
      return;
    }

    if (settings.authEnabled && (!settings.username || !settings.password)) {
      Alert.alert('Missing Credentials', 'Please enter both username and password');
      return;
    }

    Alert.alert(
      'Settings Saved',
      `Configuration updated:\n\nPort: ${settings.port}\nRoot: ${settings.basePath}\nAuth: ${settings.authEnabled ? 'Enabled' : 'Disabled'}`
    );
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    Alert.alert('Reset', 'Settings have been reset to defaults');
  };

  const selectFolder = (path: string) => {
    setSettings({ basePath: path });
    setShowFileBrowser(false);
  };

  if (showFileBrowser) {
    return <FileBrowser rootPath={settings.basePath} setRootPath={selectFolder} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <View className="flex-row items-center gap-3">
            <SettingsIcon className="text-primary" size={24} />
            <Text className="text-2xl font-bold text-foreground">Settings</Text>
          </View>
          <ThemeToggle />
        </View>

        <ConnectionSettings
          settings={settings}
          onChangeSettings={setSettings}
          onBrowseFolder={() => setShowFileBrowser(true)}
        />

        <AuthSettings settings={settings} onChangeSettings={setSettings} />

        {/* Action Buttons */}
        <View className="gap-3 px-6">
          <TouchableOpacity
            onPress={handleSave}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-4">
            <Save color="white" size={20} />
            <Text className="text-lg font-semibold text-white">Save Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReset}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-4">
            <RefreshCw className="text-secondary-foreground" size={20} />
            <Text className="text-lg font-semibold text-secondary-foreground">
              Reset to Defaults
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
