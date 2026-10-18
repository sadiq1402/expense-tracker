import { PermissionsAndroid } from 'react-native';

import SmsReader from './src/SmsReaderModule';

export * from './src/SmsReader.types';

export async function requestPermission(): Promise<boolean> {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function readInbox(sinceMs: number) {
  return SmsReader.readInbox(sinceMs);
}

export function addInboxListener(listener: () => void) {
  return SmsReader.addListener('onInboxChanged', listener);
}
