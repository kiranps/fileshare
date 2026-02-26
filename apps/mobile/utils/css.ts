import { cssInterop } from 'nativewind';
import { LucideIcon } from 'lucide-react-native';

export function interopIcon(icon: LucideIcon) {
  cssInterop(icon, {
    className: {
      target: 'style', // Map the 'className' prop to the 'style' prop
      nativeStyleToProp: {
        color: true, // Extract 'color' styles to the 'color' prop
      },
    },
  });
}
