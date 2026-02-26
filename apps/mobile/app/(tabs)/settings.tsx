import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { interopIcon }  from '@/utils/css';
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

export default function SettingsScreen() {
  const [port, setPort] = useState('2121');
  const [rootPath, setRootPath] = useState('/storage/emulated/0');
  const [protocol, setProtocol] = useState<Protocol>('FTP');
  const [authEnabled, setAuthEnabled] = useState(true);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);

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
      `Configuration updated:\n\nProtocol: ${protocol}\nPort: ${port}\nRoot: ${rootPath}\nAuth: ${authEnabled ? 'Enabled' : 'Disabled'}`
    );
  };

  const handleReset = () => {
    setPort('2121');
    setRootPath('/storage/emulated/0');
    setProtocol('FTP');
    setAuthEnabled(true);
    setUsername('admin');
    setPassword('password');
    Alert.alert('Reset', 'Settings have been reset to defaults');
  };

  const selectFolder = () => {
    // Mock folder picker
    Alert.alert('Folder Picker', 'Folder selection dialog would appear here');
  };

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <View className="flex-row items-center gap-3">
            <SettingsIcon className="text-primary" size={24} />
            <Text className="text-foreground text-2xl font-bold">Settings</Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Protocol Selection */}
        <View className="mb-6 px-6">
          <Text className="text-foreground mb-3 text-sm font-semibold uppercase tracking-wider opacity-70">
            Server Protocol
          </Text>
          <View className="bg-card border-border flex-row rounded-xl border p-2">
            {(['FTP', 'WebDAV'] as Protocol[]).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setProtocol(p)}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3 ${
                  protocol === p ? 'bg-primary' : ''
                }`}>
                <Server size={18} color={protocol === p ? 'white' : 'gray'} />
                <Text
                  className={`font-semibold ${protocol === p ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Connection Settings */}
        <View className="mb-6 px-6">
          <Text className="text-foreground mb-3 text-sm font-semibold uppercase tracking-wider opacity-70">
            Connection
          </Text>
          <View className="bg-card border-border overflow-hidden rounded-xl border">
            {/* Port */}
            <View className="border-border border-b p-4">
              <Text className="text-muted-foreground mb-2 text-sm">Server Port</Text>
              <TextInput
                value={port}
                onChangeText={setPort}
                placeholder="2121"
                keyboardType="number-pad"
                className="bg-input border-border text-foreground rounded-lg border px-4 py-3 font-mono"
              />
              <Text className="text-muted-foreground mt-2 text-xs">
                Port must be between 1 and 65535
              </Text>
            </View>

            {/* Root Path */}
            <View className="p-4">
              <Text className="text-muted-foreground mb-2 text-sm">Root Filesystem Path</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={rootPath}
                  onChangeText={setRootPath}
                  placeholder="/storage/emulated/0"
                  className="bg-input border-border text-foreground flex-1 rounded-lg border px-4 py-3 font-mono"
                />
                <TouchableOpacity
                  onPress={selectFolder}
                  className="bg-secondary border-border flex items-center justify-center rounded-lg border px-4">
                  <Folder className="text-secondary-foreground" size={20} />
                </TouchableOpacity>
              </View>
              <Text className="text-muted-foreground mt-2 text-xs">
                The folder that will be accessible to connected devices
              </Text>
            </View>
          </View>
        </View>

        {/* Authentication Settings */}
        <View className="mb-6 px-6">
          <Text className="text-foreground mb-3 text-sm font-semibold uppercase tracking-wider opacity-70">
            Authentication
          </Text>
          <View className="bg-card border-border overflow-hidden rounded-xl border">
            {/* Auth Toggle */}
            <View className="border-border border-b p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className={`rounded-lg p-2 ${authEnabled ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Shield
                      size={20}
                      className={authEnabled ? 'text-primary' : 'text-muted-foreground'}
                    />
                  </View>
                  <View>
                    <Text className="text-foreground font-medium">Enable Authentication</Text>
                    <Text className="text-muted-foreground text-xs">
                      Require username and password to connect
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setAuthEnabled(!authEnabled)}
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
                <View className="border-border border-b p-4">
                  <Text className="text-muted-foreground mb-2 text-sm">Username</Text>
                  <View className="bg-input border-border flex-row items-center rounded-lg border px-4">
                    <Lock size={18} className="text-muted-foreground mr-3" />
                    <TextInput
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Enter username"
                      className="text-foreground flex-1 py-3"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Password */}
                <View className="p-4">
                  <Text className="text-muted-foreground mb-2 text-sm">Password</Text>
                  <View className="bg-input border-border flex-row items-center rounded-lg border px-4">
                    <Lock size={18} className="text-muted-foreground mr-3" />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter password"
                      secureTextEntry={!showPassword}
                      className="text-foreground flex-1 py-3"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Text className="text-primary text-sm font-medium">
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
            className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-4">
            <Save color="white" size={20} />
            <Text className="text-lg font-semibold text-white">Save Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReset}
            className="bg-secondary flex-row items-center justify-center gap-2 rounded-xl py-4">
            <RefreshCw className="text-secondary-foreground" size={20} />
            <Text className="text-secondary-foreground text-lg font-semibold">
              Reset to Defaults
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
