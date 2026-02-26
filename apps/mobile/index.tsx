import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import { uniffiInitAsync } from 'react-native-webdav-server';

function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

uniffiInitAsync().then(() => {
  registerRootComponent(App);
});
