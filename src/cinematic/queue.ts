import { DEDUPE_WINDOW_MS, MODULE_ID, QUEUE_MAX, SETTINGS } from '../constants';
import { getSetting } from '../settings/settings';
import type { CritEvent } from '../types/module';
import { runCinematic } from './runner';

interface Slot {
  event: CritEvent;
  enqueuedAt: number;
}

const queue: Slot[] = [];
const recentMessages = new Map<string, number>();
let playing = false;

export function enqueue(event: CritEvent): void {
  if (!getSetting<boolean>(SETTINGS.SHOW_CINEMATICS)) return;

  const now = performance.now();
  const seen = recentMessages.get(event.messageId);
  if (seen !== undefined && now - seen < DEDUPE_WINDOW_MS) return;
  recentMessages.set(event.messageId, now);
  pruneSeen(now);

  if (queue.length >= QUEUE_MAX) {
    const dropped = queue.shift();
    console.debug(`${MODULE_ID} | queue full, dropped:`, dropped?.event.messageId);
  }
  queue.push({ event, enqueuedAt: now });

  if (!playing) void drain();
}

async function drain(): Promise<void> {
  if (playing) return;
  playing = true;
  try {
    while (queue.length > 0) {
      const slot = queue.shift();
      if (!slot) break;
      try {
        await runCinematic(slot.event);
      } catch (err) {
        console.error(`${MODULE_ID} | cinematic failed:`, err);
      }
    }
  } finally {
    playing = false;
  }
}

function pruneSeen(now: number): void {
  for (const [id, ts] of recentMessages) {
    if (now - ts > DEDUPE_WINDOW_MS * 4) recentMessages.delete(id);
  }
}

export function _testReset(): void {
  queue.length = 0;
  recentMessages.clear();
  playing = false;
}
