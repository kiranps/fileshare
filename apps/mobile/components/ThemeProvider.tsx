import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { lightTheme, darkTheme } from '../theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { colorScheme } = useColorScheme();

  const themeVars = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <View style={themeVars} className={`${colorScheme} bg-background flex-1`}>
      {children}
    </View>
  );
}
