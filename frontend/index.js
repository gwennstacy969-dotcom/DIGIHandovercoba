import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Disable Google Chrome auto-translate globally on Web to prevent 'AD' -> 'IKLAN' and UI flickering
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    document.documentElement.setAttribute('lang', 'id');
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    if (document.body) {
      document.body.setAttribute('translate', 'no');
      document.body.classList.add('notranslate');
    }
    let meta = document.querySelector('meta[name="google"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
    }
    let metaBot = document.querySelector('meta[name="googlebot"]');
    if (!metaBot) {
      metaBot = document.createElement('meta');
      metaBot.name = 'googlebot';
      metaBot.content = 'notranslate';
      document.head.appendChild(metaBot);
    }
  } catch (_) {}
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

