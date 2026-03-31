import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Lock, Shield } from 'lucide-react-native';
import { interopIcon } from '@/utils/css';
import type { Settings } from '@/store/serverStore';

interopIcon(Lock);
interopIcon(Shield);

interface AuthSettingsProps {
  settings: Pick<Settings, 'authEnabled' | 'username' | 'password'>;
  onChangeSettings: (patch: Partial<Settings>) => void;
}

export default function AuthSettings({ settings, onChangeSettings }: AuthSettingsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { authEnabled, username, password } = settings;

  return (
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
              onPress={() => onChangeSettings({ authEnabled: !authEnabled })}
              className={`h-7 w-12 rounded-full p-1 ${authEnabled ? 'bg-primary' : 'bg-muted'}`}>
              <View
                className={`h-5 w-5 rounded-full bg-white shadow-sm ${
                  authEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Credential fields — shown only when auth is enabled */}
        {authEnabled && (
          <>
            {/* Username */}
            <View className="border-b border-border p-4">
              <Text className="mb-2 text-sm text-muted-foreground">Username</Text>
              <View className="flex-row items-center rounded-lg border border-border bg-input px-4">
                <Lock size={18} className="mr-3 text-muted-foreground" />
                <TextInput
                  value={username}
                  onChangeText={(v) => onChangeSettings({ username: v })}
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
                  onChangeText={(v) => onChangeSettings({ password: v })}
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
  );
}
