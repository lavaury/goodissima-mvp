type ParticipantRole = "OWNER" | "CANDIDATE";

export type RelationMediaSignalType = "offer" | "answer" | "candidate" | "leave";

export type RelationMediaSignalMessage = {
  id: string;
  sessionId: string;
  from: string;
  role: ParticipantRole;
  type: RelationMediaSignalType;
  payload: unknown;
  cursor: number;
  createdAt: number;
};

type ParticipantPresence = {
  peerId: string;
  role: ParticipantRole;
  seenAt: number;
};

type ParticipantLeave = {
  peerId: string;
  role: ParticipantRole;
  sessionId: string;
  caseId: string | null;
  leftAt: number;
};

type SignalingStore = {
  messages: RelationMediaSignalMessage[];
  participants: Map<string, ParticipantPresence>;
  leaves: Map<string, ParticipantLeave>;
  nextCursor: number;
};

const globalStore = globalThis as typeof globalThis & {
  __goodissimaRelationMediaSignaling?: Map<string, SignalingStore>;
};

const stores = globalStore.__goodissimaRelationMediaSignaling ?? new Map<string, SignalingStore>();
globalStore.__goodissimaRelationMediaSignaling = stores;

const MESSAGE_TTL_MS = 10 * 60 * 1000;
const PRESENCE_TTL_MS = 20 * 1000;

function storeFor(sessionId: string) {
  const existing = stores.get(sessionId);
  if (existing) return existing;

  const next = {
    messages: [],
    participants: new Map<string, ParticipantPresence>(),
    leaves: new Map<string, ParticipantLeave>(),
    nextCursor: 0,
  };
  stores.set(sessionId, next);
  return next;
}

function prune(store: SignalingStore, now: number) {
  store.messages = store.messages.filter((message) => now - message.createdAt <= MESSAGE_TTL_MS);

  for (const [peerId, presence] of store.participants.entries()) {
    if (now - presence.seenAt > PRESENCE_TTL_MS) {
      store.participants.delete(peerId);
    }
  }
}

export function exchangeRelationMediaSignals(input: {
  sessionId: string;
  caseId?: string | null;
  peerId: string;
  role: ParticipantRole;
  cursor: number;
  outgoing: Array<{ type: RelationMediaSignalType; payload: unknown }>;
}) {
  const now = Date.now();
  const store = storeFor(input.sessionId);
  prune(store, now);

  store.participants.set(input.peerId, {
    peerId: input.peerId,
    role: input.role,
    seenAt: now,
  });

  for (const outgoing of input.outgoing) {
    if (outgoing.type === "leave") {
      const payload = outgoing.payload && typeof outgoing.payload === "object" && !Array.isArray(outgoing.payload)
        ? outgoing.payload as { leftAt?: unknown; caseId?: unknown }
        : {};
      store.participants.delete(input.peerId);
      store.leaves.set(input.peerId, {
        peerId: input.peerId,
        role: input.role,
        sessionId: input.sessionId,
        caseId: typeof payload.caseId === "string" ? payload.caseId : input.caseId ?? null,
        leftAt: typeof payload.leftAt === "number" ? payload.leftAt : now,
      });
    }

    store.messages.push({
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      sessionId: input.sessionId,
      from: input.peerId,
      role: input.role,
      type: outgoing.type,
      payload: outgoing.payload,
      cursor: ++store.nextCursor,
      createdAt: Date.now(),
    });
  }

  const messages = store.messages.filter((message) => message.from !== input.peerId && message.cursor > input.cursor);
  const participants = Array.from(store.participants.values()).map((presence) => ({
    peerId: presence.peerId,
    role: presence.role,
    isSelf: presence.peerId === input.peerId,
    seenAt: presence.seenAt,
  }));

  const leaves = Array.from(store.leaves.values()).map((leave) => ({
    ...leave,
    isSelf: leave.peerId === input.peerId,
  }));

  return { messages, participants, leaves, cursor: store.nextCursor };
}

export function clearRelationMediaSignals(sessionId: string) {
  stores.delete(sessionId);
}
