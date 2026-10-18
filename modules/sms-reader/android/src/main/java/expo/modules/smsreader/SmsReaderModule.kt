package expo.modules.smsreader

import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  // Fires after the SMS app has written the message, so JS can re-scan the inbox and see it with its final id
  private val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
    override fun onChange(selfChange: Boolean) {
      sendEvent("onInboxChanged")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Events("onInboxChanged")

    OnStartObserving {
      appContext.reactContext?.contentResolver?.registerContentObserver(Telephony.Sms.CONTENT_URI, true, observer)
    }

    OnStopObserving {
      appContext.reactContext?.contentResolver?.unregisterContentObserver(observer)
    }

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
