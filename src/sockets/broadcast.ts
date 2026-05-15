import { enqueue } from '../cinematic/queue';
import { MODULE_ID, SOCKET_CHANNEL } from '../constants';
import type { BroadcastPayload, CritEvent } from '../types/module';

declare const game: {
  user: { id: string };
  socket: {
    emit(channel: string, payload: unknown): void;
    on(channel: string, fn: (payload: unknown) => void): void;
  };
};

export function registerSockets(): void {
  game.socket.on(SOCKET_CHANNEL, (raw: unknown) => {
    const payload = raw as BroadcastPayload;
    if (!payload || payload.type !== 'critical') return;
    if (payload.event.originUserId === game.user.id) return;
    enqueue(payload.event);
  });
  console.debug(`${MODULE_ID} | socket listener registered on`, SOCKET_CHANNEL);
}

export function broadcastCrit(event: CritEvent): void {
  const payload: BroadcastPayload = { type: 'critical', event };
  game.socket.emit(SOCKET_CHANNEL, payload);
}
