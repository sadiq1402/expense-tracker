import { randomUUID } from 'expo-crypto';

import { readInbox } from '../../modules/sms-reader';
import { repo, type NeedsReviewItem } from '@/db/repo';
import { categorize, classifyCredit } from '@/domain/categorize';
import { mergeIntoExisting } from '@/domain/ingest';
import { parseSms } from '@/domain/parseSms';
import { nextCheckpoint, scanSince } from '@/domain/scanWindow';
import type { MerchantRule, ParsedTxn, RawSms, Transaction } from '@/domain/types';

type IngestResult = { added: number; review: number };

let running: Promise<IngestResult> | null = null;
let queued: Promise<IngestResult> | null = null;

// Never overwrites a Category the user (or an earlier run) already set
const withCategory = (txns: Transaction[], rules: MerchantRule[]) =>
  txns.map((t) => (t.categoryId ? t : { ...t, categoryId: categorize(t, rules) }));

const isUnclassifiedCredit = (t: Transaction) => t.direction === 'credit' && !t.isRefund && !t.categoryId;

// Fresh copies in `txns` override their stale stored versions in the history
const withRefunds = (txns: Transaction[], stored: Transaction[]) => {
  const history = [...new Map([...stored, ...txns].map((t) => [t.id, t])).values()];
  return txns.map((t) => (isUnclassifiedCredit(t) ? { ...t, ...classifyCredit(t, history) } : t));
};

async function ingest() {
  const last = await repo.getMeta('lastSmsAt');
  const inbox = await readInbox(scanSince(last === null ? null : Number(last), Date.now()));

  const parsed: ParsedTxn[] = [];
  const review: NeedsReviewItem[] = [];
  for (const sms of inbox) {
    const r = parseSms(sms);
    if (r.kind === 'transaction') parsed.push(r.txn);
    else if (r.kind === 'needs_review') review.push({ sms: r.sms, reason: r.reason });
  }

  const existing = await repo.allTransactions();
  const { created, updated } = mergeIntoExisting(existing, parsed, randomUUID);
  const touched = new Set(updated.map((t) => t.id));
  // Also picks up debits stored before categorization existed
  const backlog = existing.filter((t) => !t.categoryId && t.direction === 'debit' && !touched.has(t.id));
  const categorized = withCategory([...created, ...updated, ...backlog], await repo.userRules());
  // Stored credits are re-checked too, so refunds ingested before Refund detection are picked up
  const credits = existing.filter((t) => isUnclassifiedCredit(t) && !touched.has(t.id));
  const classified = withRefunds([...categorized, ...credits], existing);
  await repo.upsertTransactions(classified.filter((t, i) => i < categorized.length || t.isRefund));
  await repo.addNeedsReview(review);
  if (inbox.length > 0) {
    await repo.setMeta('lastSmsAt', String(nextCheckpoint(inbox.map((s) => s.receivedAt), Date.now())));
  }
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
  const categorized = withCategory(created, await repo.userRules());
  await repo.upsertTransactions(withRefunds(categorized, await repo.allTransactions()));
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
