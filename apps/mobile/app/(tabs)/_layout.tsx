import { Tabs } from 'expo-router';
import { Server, Settings } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { interopIcon } from '@/utils/css';

// Enable className styling for Lucide icons
interopIcon(Server);
interopIcon(Settings);

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#0f0f1a' : '#fafaff',
          borderTopColor: isDark ? '#262641' : '#e2e8f0',
        },
        tabBarActiveTintColor: isDark ? '#818cf8' : '#4f46e5',
        tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Server',
          tabBarIcon: ({ focused }) => (
            <Server className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <Settings className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
