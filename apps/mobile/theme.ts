import { vars } from 'nativewind';

export const lightTheme = vars({
  '--radius': '12',

  // Core semantic colors - Midnight Indigo Theme (Tech/Professional)
  '--background': '250 250 255', // Very light blue tint
  '--foreground': '15 23 42', // Deep slate

  '--card': '255 255 255',
  '--card-foreground': '15 23 42',

  '--popover': '255 255 255',
  '--popover-foreground': '15 23 42',

  '--primary': '79 70 229', // Indigo
  '--primary-foreground': '255 255 255',

  '--secondary': '224 231 255', // Light indigo
  '--secondary-foreground': '55 48 163',

  '--muted': '241 245 249',
  '--muted-foreground': '100 116 139',

  '--accent': '165 180 252',
  '--accent-foreground': '49 46 129',

  '--destructive': '220 38 38',

  '--border': '226 232 240',
  '--input': '241 245 249',
  '--ring': '79 70 229',

  // Chart colors
  '--chart-1': '99 102 241',
  '--chart-2': '129 140 248',
  '--chart-3': '165 180 252',
  '--chart-4': '192 132 252',
  '--chart-5': '79 70 229',

  // Sidebar colors
  '--sidebar': '250 250 255',
  '--sidebar-foreground': '15 23 42',
  '--sidebar-primary': '79 70 229',
  '--sidebar-primary-foreground': '255 255 255',
  '--sidebar-accent': '224 231 255',
  '--sidebar-accent-foreground': '55 48 163',
  '--sidebar-border': '226 232 240',
  '--sidebar-ring': '79 70 229',
});

export const darkTheme = vars({
  '--radius': '12',

  // Core semantic colors - Dark Tech Theme
  '--background': '15 15 26', // Very dark blue/gray
  '--foreground': '241 245 249', // Light slate

  '--card': '24 24 40', // Slightly lighter dark
  '--card-foreground': '241 245 249',

  '--popover': '45 45 65',
  '--popover-foreground': '241 245 249',

  '--primary': '129 140 248', // Lighter indigo for dark mode
  '--primary-foreground': '15 23 42',

  '--secondary': '38 38 65',
  '--secondary-foreground': '199 210 254',

  '--muted': '38 38 65',
  '--muted-foreground': '148 163 184',

  '--accent': '67 56 202',
  '--accent-foreground': '224 231 255',

  '--destructive': '248 113 113',

  '--border': '38 38 65',
  '--input': '45 45 65',
  '--ring': '129 140 248',

  // Chart colors
  '--chart-1': '99 102 241',
  '--chart-2': '34 197 94',
  '--chart-3': '244 162 97',
  '--chart-4': '168 85 247',
  '--chart-5': '239 68 68',

  // Sidebar colors
  '--sidebar': '24 24 40',
  '--sidebar-foreground': '241 245 249',
  '--sidebar-primary': '99 102 241',
  '--sidebar-primary-foreground': '241 245 249',
  '--sidebar-accent': '45 45 65',
  '--sidebar-accent-foreground': '241 245 249',
  '--sidebar-border': '38 38 65',
  '--sidebar-ring': '82 82 82',
});
