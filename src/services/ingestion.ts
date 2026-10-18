import { randomUUID } from 'expo-crypto';

import { readInbox } from '../../modules/sms-reader';
import { repo, type NeedsReviewItem } from '@/db/repo';
import { mergeIntoExisting } from '@/domain/ingest';
import { parseSms } from '@/domain/parseSms';
import { nextCheckpoint, scanSince } from '@/domain/scanWindow';
import type { ParsedTxn, RawSms } from '@/domain/types';

type IngestResult = { added: number; review: number };

let running: Promise<IngestResult> | null = null;
let queued: Promise<IngestResult> | null = null;

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
    sourceSender: sms.sender,
  };
  // Merged against nothing: the user is asserting this SMS is its own Transaction
  const { created } = mergeIntoExisting([], [txn], randomUUID);
  await repo.upsertTransactions(created);
  await repo.resolveNeedsReview(sms.id);
}

// Calls during a run share one queued follow-up run, so an SMS that lands mid-scan is still picked up
export function runIngestion(): Promise<IngestResult> {
  if (running) {
    queued ??= running
      .catch(() => undefined)
      .then(() => {
        queued = null;
        return runIngestion();
      });
    return queued;
  }
  running = ingest().finally(() => {
    running = null;
  });
  return running;
}
