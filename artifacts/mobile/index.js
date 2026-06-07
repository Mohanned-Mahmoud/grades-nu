import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// Must be exported so Fast Refresh updates correctly in development
export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);