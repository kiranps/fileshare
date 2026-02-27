import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { interopIcon } from '@/utils/css';
import {
  Settings as SettingsIcon,
  Server,
  Folder,
  Lock,
  Shield,
  Save,
  RefreshCw,
} from 'lucide-react-native';

interopIcon(SettingsIcon);
interopIcon(Server);
interopIcon(Folder);
interopIcon(Lock);
interopIcon(Shield);
interopIcon(Save);
interopIcon(RefreshCw);

type Protocol = 'FTP' | 'WebDAV';

import { useServerStore } from '@/store/serverStore';

export default function SettingsScreen() {
  const settings = useServerStore((s: any) => s.settings);
  const setSettings = useServerStore((s: any) => s.setSettings);
  const [showPassword, setShowPassword] = useState(false);

  const port = settings.portSetting;
  const rootPath = settings.basePath;
  const authEnabled = settings.authEnabled;
  const username = settings.username;
  const password = settings.password;
  console.log(settings);

  const handleSave = () => {
    // Validate port
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert('Invalid Port', 'Please enter a valid port number (1-65535)');
      return;
    }

    // Validate auth credentials if enabled
    if (authEnabled && (!username || !password)) {
      Alert.alert('Missing Credentials', 'Please enter both username and password');
      return;
    }

    Alert.alert(
      'Settings Saved',
      `Configuration updated:\n\nPort: ${port}\nRoot: ${rootPath}\nAuth: ${authEnabled ? 'Enabled' : 'Disabled'}`
    );
  };

  const handleReset = () => {
    setSettings({
      portSetting: '2121',
      basePath: '/storage/emulated/0',
      authEnabled: true,
      username: 'admin',
      password: 'password',
    });
    Alert.alert('Reset', 'Settings have been reset to defaults');
  };

  const selectFolder = () => {
    // Mock folder picker
    Alert.alert('Folder Picker', 'Folder selection dialog would appear here');
  };

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


        {/* Connection Settings */}
        <View className="mb-6 px-6">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
            Connection
          </Text>
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Port */}
            <View className="border-b border-border p-4">
              <Text className="mb-2 text-sm text-muted-foreground">Server Port</Text>
              <TextInput
                value={port}
                onChangeText={(v) => setSettings({ portSetting: v })}
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
              <View className="flex-row gap-2">
                <TextInput
                  value={rootPath}
                  onChangeText={(v) => setSettings({ basePath: v })}
                  placeholder="/storage/emulated/0"
                  className="flex-1 rounded-lg border border-border bg-input px-4 py-3 font-mono text-foreground"
                />
                <TouchableOpacity
                  onPress={selectFolder}
                  className="flex items-center justify-center rounded-lg border border-border bg-secondary px-4">
                  <Folder className="text-secondary-foreground" size={20} />
                </TouchableOpacity>
              </View>
              <Text className="mt-2 text-xs text-muted-foreground">
                The folder that will be accessible to connected devices
              </Text>
            </View>
          </View>
        </View>

        {/* Authentication Settings */}
        <View className="mb-6 px-6">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
            Authentication
          </Text>
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Auth Toggle */}
            <View className="border-b border-border p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className={`rounded-lg p-2 ${authEnabled ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Shield
                      size={20}
                      className={authEnabled ? 'text-primary' : 'text-muted-foreground'}
                    />
                  </View>
                  <View>
                    <Text className="font-medium text-foreground">Enable Authentication</Text>
                    <Text className="text-xs text-muted-foreground">
                      Require username and password to connect
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSettings({ authEnabled: !authEnabled })}
                  className={`h-7 w-12 rounded-full p-1 ${authEnabled ? 'bg-primary' : 'bg-muted'}`}>
                  <View
                    className={`h-5 w-5 rounded-full bg-white shadow-sm ${
                      authEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Username */}
            {authEnabled && (
              <>
                <View className="border-b border-border p-4">
                  <Text className="mb-2 text-sm text-muted-foreground">Username</Text>
                  <View className="flex-row items-center rounded-lg border border-border bg-input px-4">
                    <Lock size={18} className="mr-3 text-muted-foreground" />
                    <TextInput
                      value={username}
                      onChangeText={(v) => setSettings({ username: v })}
                      placeholder="Enter username"
                      className="flex-1 py-3 text-foreground"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Password */}
                <View className="p-4">
                  <Text className="mb-2 text-sm text-muted-foreground">Password</Text>
                  <View className="flex-row items-center rounded-lg border border-border bg-input px-4">
                    <Lock size={18} className="mr-3 text-muted-foreground" />
                    <TextInput
                      value={password}
                      onChangeText={(v) => setSettings({ password: v })}
                      placeholder="Enter password"
                      secureTextEntry={!showPassword}
                      className="flex-1 py-3 text-foreground"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Text className="text-sm font-medium text-primary">
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

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
