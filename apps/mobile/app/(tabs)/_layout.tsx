import { Tabs } from 'expo-router';
import { Server, Settings } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { interopIcon } from '@/utils/css';
import {
  TAB_ACTIVE_COLOR_LIGHT,
  TAB_ACTIVE_COLOR_DARK,
  TAB_INACTIVE_COLOR_LIGHT,
  TAB_INACTIVE_COLOR_DARK,
  TAB_BAR_BG_LIGHT,
  TAB_BAR_BG_DARK,
  TAB_BORDER_COLOR_LIGHT,
  TAB_BORDER_COLOR_DARK,
} from '@/constants';

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
          backgroundColor: isDark ? TAB_BAR_BG_DARK : TAB_BAR_BG_LIGHT,
          borderTopColor: isDark ? TAB_BORDER_COLOR_DARK : TAB_BORDER_COLOR_LIGHT,
        },
        tabBarActiveTintColor: isDark ? TAB_ACTIVE_COLOR_DARK : TAB_ACTIVE_COLOR_LIGHT,
        tabBarInactiveTintColor: isDark ? TAB_INACTIVE_COLOR_DARK : TAB_INACTIVE_COLOR_LIGHT,
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
