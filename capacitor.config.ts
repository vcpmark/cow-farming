import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cowfarming.farmfriends',
  appName: 'Farm Friends',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#87CEEB',
    preferredContentMode: 'mobile',
  },
};

export default config;
