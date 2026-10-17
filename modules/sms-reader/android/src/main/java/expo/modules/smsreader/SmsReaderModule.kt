package expo.modules.smsreader

import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    AsyncFunction("readInbox") { sinceMs: Double ->
      val resolver = appContext.reactContext?.contentResolver ?: throw Exceptions.ReactContextLost()
      val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE,
      )
      val messages = mutableListOf<Map<String, Any?>>()
      resolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        "${Telephony.Sms.DATE} > ?",
        arrayOf(sinceMs.toLong().toString()),
        "${Telephony.Sms.DATE} ASC",
      )?.use { c ->
        while (c.moveToNext()) {
          messages.add(
            mapOf(
              "id" to c.getLong(0).toString(),
              "sender" to (c.getString(1) ?: ""),
              "body" to (c.getString(2) ?: ""),
              "receivedAt" to c.getLong(3).toDouble(),
            ),
          )
        }
      }
      messages
    }
  }
}
