import { randomUUID } from 'expo-crypto';

import { readInbox } from '../../modules/sms-reader';
import { repo, type NeedsReviewItem } from '@/db/repo';
import { discoverAccounts, markCardBillPayments, markSelfTransfers } from '@/domain/accounts';
import { categorize, classifyCredit } from '@/domain/categorize';
import { flagUnchecked } from '@/domain/categoryCheck';
import { mergeIntoExisting } from '@/domain/ingest';
import { parseSms } from '@/domain/parseSms';
import { refreshMerchants } from '@/domain/reparse';
import { nextCheckpoint, scanSince } from '@/domain/scanWindow';
import type { MerchantRule, ParsedTxn, RawSms, Transaction } from '@/domain/types';

type IngestResult = { added: number; review: number };

let running: Promise<IngestResult> | null = null;
let queued: Promise<IngestResult> | null = null;
const finished = new Set<() => void>();

// Lets the Category Check open once the scan that runs on launch or return to the app has landed
export function onIngested(listener: () => void) {
  finished.add(listener);
  return () => {
    finished.delete(listener);
  };
}

// Never overwrites a Category the user (or an earlier run) already set
const withCategory = (txns: Transaction[], rules: MerchantRule[]) =>
  txns.map((t) => (t.categoryId ? t : { ...t, categoryId: categorize(t, rules) }));

const isUnclassifiedCredit = (t: Transaction) => t.direction === 'credit' && !t.isRefund && !t.categoryId;

// Fresh copies in `txns` override their stale stored versions in the history
const withRefunds = (txns: Transaction[], stored: Transaction[]) => {
  const history = [...new Map([...stored, ...txns].map((t) => [t.id, t])).values()];
  return txns.map((t) => (isUnclassifiedCredit(t) ? { ...t, ...classifyCredit(t, history) } : t));
};

// Runs over everything stored so a pair split across two scans is still found
async function withAccountsAndSelfTransfers(existing: Transaction[], toSave: Transaction[]) {
  const all = [...new Map([...existing, ...toSave].map((t) => [t.id, t])).values()];
  await repo.upsertAccounts(discoverAccounts(all, await repo.accounts(), randomUUID));
  const merged = new Map(toSave.map((t) => [t.id, t]));
  for (const t of [...markSelfTransfers(all), ...markCardBillPayments(all)]) merged.set(t.id, t);
  return [...merged.values()];
}

// Bump when the parser learns new SMS formats, so stored Transactions are re-read once and gain their Merchants
const PARSER_VERSION = 2;

async function reparseIfParserChanged() {
  if (Number((await repo.getMeta('parserVersion')) ?? 1) >= PARSER_VERSION) return;
  const stored = await repo.allTransactions();
  // A fresh install has nothing to refresh; its first scan already uses the current parser
  if (stored.length > 0) {
    const inbox = await readInbox(scanSince(null, Date.now()));
    const fresh = inbox.flatMap((sms) => {
      const r = parseSms(sms);
      return r.kind === 'transaction' ? [r.txn] : [];
    });
    await repo.upsertTransactions(refreshMerchants(stored, fresh, await repo.userRules()));
  }
  await repo.setMeta('parserVersion', String(PARSER_VERSION));
}

async function ingest() {
  await reparseIfParserChanged();
  const last = await repo.getMeta('lastSmsAt');
  const inbox = await readInbox(scanSince(last === null ? null : Number(last), Date.now()));

  const parsed: ParsedTxn[] = [];
  const parsedSms: RawSms[] = [];
  const review: NeedsReviewItem[] = [];
  for (const sms of inbox) {
    const r = parseSms(sms);
    if (r.kind === 'transaction') {
      parsed.push(r.txn);
      parsedSms.push(sms);
    } else if (r.kind === 'needs_review') review.push({ sms: r.sms, reason: r.reason });
  }

  const existing = await repo.allTransactions();
  const { created, updated } = mergeIntoExisting(existing, parsed, randomUUID);
  const touched = new Set(updated.map((t) => t.id));
  // Also picks up debits stored before categorization existed
  const backlog = existing.filter((t) => !t.categoryId && t.direction === 'debit' && !touched.has(t.id));
  const [rules, mixed] = await Promise.all([repo.userRules(), repo.mixedMerchants()]);
  // Only brand-new SMS Expenses go to the Category Check; the first scan's months of backfill aren't asked about
  const fresh = withCategory(created, rules);
  const flagged = last === null ? fresh : flagUnchecked(fresh, existing, rules, mixed);
  const categorized = [...flagged, ...withCategory([...updated, ...backlog], rules)];
  // Stored credits are re-checked too, so refunds ingested before Refund detection are picked up
  const credits = existing.filter((t) => isUnclassifiedCredit(t) && !touched.has(t.id));
  const classified = withRefunds([...categorized, ...credits], existing);
  const toSave = classified.filter((t, i) => i < categorized.length || t.isRefund);
  await repo.upsertTransactions(await withAccountsAndSelfTransfers(existing, toSave));
  await repo.saveSms(parsedSms);
  await repo.addNeedsReview(review);
  if (inbox.length > 0) {
    await repo.setMeta(
      'lastSmsAt',
      String(
        nextCheckpoint(
          inbox.map((s) => s.receivedAt),
          Date.now(),
        ),
      ),
    );
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
  await repo.saveSms([sms]);
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
  running = ingest()
    .then((result) => {
      finished.forEach((listener) => listener());
      return result;
    })
    .finally(() => {
      running = null;
    });
  return running;
}
