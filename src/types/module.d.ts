export interface CritEvent {
  messageId: string;
  actorId: string;
  actorName: string;
  isPC: boolean;
  imagePath: string;
  durationMs: number;
  startTimestamp: number;
  originUserId: string;
}

export interface BroadcastPayload {
  type: 'critical';
  event: CritEvent;
}

export interface ActorFlagData {
  schemaVersion: number;
  enabled?: boolean;
  portraitOverride?: string | null;
}

export interface PublicAPI {
  triggerLocal(actorId: string): Promise<void>;
  triggerBroadcast(actorId: string): Promise<void>;
  readonly version: string;
}
