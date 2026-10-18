import { randomUUID } from 'expo-crypto';

import { readInbox } from '../../modules/sms-reader';
import { repo, type NeedsReviewItem } from '@/db/repo';
import { mergeIntoExisting } from '@/domain/ingest';
import { parseSms } from '@/domain/parseSms';
import { nextCheckpoint, scanSince } from '@/domain/scanWindow';
import type { ParsedTxn, RawSms } from '@/domain/types';

let running: Promise<{ added: number; review: number }> | null = null;

async function ingest() {
  const last = await repo.getMeta('lastSmsAt');
  const inbox = await readInbox(scanSince(last === null ? null : Number(last), Date.now()));
  if (inbox.length === 0) return { added: 0, review: 0 };

  const parsed: ParsedTxn[] = [];
  const review: NeedsReviewItem[] = [];
  for (const sms of inbox) {
    const r = parseSms(sms);
    if (r.kind === 'transaction') parsed.push(r.txn);
    else if (r.kind === 'needs_review') review.push({ sms: r.sms, reason: r.reason });
  }

  const { created, updated } = mergeIntoExisting(await repo.allTransactions(), parsed, randomUUID);
  await repo.upsertTransactions([...created, ...updated]);
  await repo.addNeedsReview(review);
  await repo.setMeta('lastSmsAt', String(nextCheckpoint(inbox.map((s) => s.receivedAt), Date.now())));
  return { added: created.length, review: review.length };
}

export async function createFromReview(sms: RawSms, input: Pick<ParsedTxn, 'amountPaise' | 'direction' | 'merchant'>) {
  const txn: ParsedTxn = {
    ...input,
    occurredAt: sms.receivedAt,
    accountMask: null,
    upiRef: null,
    channel: 'other',
    sourceSmsId: sms.id,
  };
  const { created } = mergeIntoExisting(await repo.allTransactions(), [txn], randomUUID);
  await repo.upsertTransactions(created);
  await repo.resolveNeedsReview(sms.id);
}

// Concurrent callers share one in-flight run
export function runIngestion() {
  running ??= ingest().finally(() => {
    running = null;
  });
  return running;
}
