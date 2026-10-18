import { NativeModule, requireNativeModule } from 'expo';

import type { RawSms } from './SmsReader.types';

type SmsReaderEvents = {
  onInboxChanged(): void;
};

declare class SmsReaderModule extends NativeModule<SmsReaderEvents> {
  readInbox(sinceMs: number): Promise<RawSms[]>;
}

export default requireNativeModule<SmsReaderModule>('SmsReader');
