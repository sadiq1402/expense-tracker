# On-device SMS ingestion, no backend

Transactions are captured by parsing bank/UPI SMS on an Android phone (React Native + Expo with a native SMS module) and stored only in on-device SQLite. There is no server.

UPI apps expose no public API. Account Aggregator needs a licensed provider, which is too heavy for a personal tool, and email/statement import is either delayed or manual. Reading SMS is real-time and free, and it covers every bank, so we accept the costs: the app is Android-only, it can't go on the Play Store (it is sideloaded as an APK), and data survives only through manual export.
