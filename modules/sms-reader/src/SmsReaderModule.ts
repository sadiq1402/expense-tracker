import { NativeModule, requireNativeModule } from 'expo';

import type { RawSms } from './SmsReader.types';

declare class SmsReaderModule extends NativeModule<{}> {
  readInbox(sinceMs: number): Promise<RawSms[]>;
}

export default requireNativeModule<SmsReaderModule>('SmsReader');
