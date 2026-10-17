import { randomUUID } from 'expo-crypto';

import { readInbox } from '../../modules/sms-reader';
import { repo } from '@/db/repo';
import { mergeIntoExisting } from '@/domain/ingest';
import { parseSms } from '@/domain/parseSms';
import { scanSince } from '@/domain/scanWindow';
import type { ParsedTxn } from '@/domain/types';

let running: Promise<{ added: number }> | null = null;

async function ingest() {
  const last = await repo.getMeta('lastSmsAt');
  const inbox = await readInbox(scanSince(last === null ? null : Number(last), Date.now()));
  if (inbox.length === 0) return { added: 0 };

  const parsed: ParsedTxn[] = [];
  for (const sms of inbox) {
    const r = parseSms(sms);
    if (r.kind === 'transaction') parsed.push(r.txn);
  }

  const { created, updated } = mergeIntoExisting(await repo.allTransactions(), parsed, randomUUID);
  await repo.upsertTransactions([...created, ...updated]);
  await repo.setMeta('lastSmsAt', String(Math.max(...inbox.map((s) => s.receivedAt))));
  return { added: created.length };
}

// Concurrent callers share one in-flight run
export function runIngestion() {
  running ??= ingest().finally(() => {
    running = null;
  });
  return running;
}
