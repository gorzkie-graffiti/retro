import type { ChatMessage, Conversation } from "../types";
import { makeId } from "./id";

export const MAX_TITLE_LENGTH = 52;

export function newConversation(model: string, now = Date.now()): Conversation {
  return {
    id: makeId("conv"),
    title: "New conversation",
    model,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function newMessage(
  role: ChatMessage["role"],
  content: string,
  meta?: ChatMessage["meta"],
): ChatMessage {
  return {
    id: makeId("msg"),
    role,
    content,
    createdAt: Date.now(),
    ...(meta ? { meta } : {}),
  };
}

export function deriveTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return "New conversation";
  }
  if (singleLine.length <= MAX_TITLE_LENGTH) {
    return singleLine;
  }
  const clipped = singleLine.slice(0, MAX_TITLE_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const clean = lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped;
  return `${clean.trimEnd()}…`;
}

export function appendMessage(
  conversation: Conversation,
  message: ChatMessage,
): Conversation {
  const messages = [...conversation.messages, message];
  const firstUser = messages.find(
    (item) => item.role === "user" && item.content.trim(),
  );
  return {
    ...conversation,
    messages,
    title: firstUser ? deriveTitle(firstUser.content) : conversation.title,
    updatedAt: message.createdAt,
    model: message.meta?.model ?? conversation.model,
  };
}

/** Build the OpenAI-compatible history payload; failed/empty replies are excluded. */
export function toApiMessages(
  conversation: Conversation,
): Array<Pick<ChatMessage, "role" | "content">> {
  return conversation.messages
    .filter(
      (message) => !message.meta?.error && message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function latestAssistantAnswer(
  conversation: Conversation | null | undefined,
): ChatMessage | null {
  if (!conversation) {
    return null;
  }
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index];
    if (
      message.role === "assistant" &&
      !message.meta?.error &&
      message.content.trim()
    ) {
      return message;
    }
  }
  return null;
}

export function hasMessages(conversation: Conversation): boolean {
  return conversation.messages.length > 0;
}

export function sortConversations(
  conversations: Conversation[],
): Conversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function countUserMessages(conversation: Conversation): number {
  return conversation.messages.filter((message) => message.role === "user")
    .length;
}

export function previewText(content: string, maxLength = 120): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength - 1).trimEnd()}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.role !== "user" && value.role !== "assistant") {
    return null;
  }
  if (typeof value.id !== "string" || typeof value.content !== "string") {
    return null;
  }
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) {
    return null;
  }

  let meta: ChatMessage["meta"];
  if (isRecord(value.meta)) {
    meta = {};
    if (typeof value.meta.model === "string") meta.model = value.meta.model;
    if (
      typeof value.meta.durationMs === "number" &&
      Number.isFinite(value.meta.durationMs)
    ) {
      meta.durationMs = value.meta.durationMs;
    }
    if (typeof value.meta.error === "string") meta.error = value.meta.error;
    if (value.meta.cancelled === true) meta.cancelled = true;
  }

  return {
    id: value.id,
    role: value.role,
    content: value.content,
    createdAt: value.createdAt,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}

export function parseConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: Conversation[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.createdAt !== "number" ||
      !Number.isFinite(item.createdAt) ||
      typeof item.updatedAt !== "number" ||
      !Number.isFinite(item.updatedAt) ||
      !Array.isArray(item.messages)
    ) {
      continue;
    }

    const messages = item.messages
      .map(parseMessage)
      .filter((message): message is ChatMessage => message !== null);

    parsed.push({
      id: item.id,
      title: item.title.trim() || "New conversation",
      model:
        typeof item.model === "string" && item.model.trim()
          ? item.model
          : "gemini-3.6-flash",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      messages,
    });
  }

  return sortConversations(parsed);
}

export function mergeConversation(
  conversations: Conversation[],
  updated: Conversation,
): Conversation[] {
  return sortConversations(
    conversations.map((conversation) =>
      conversation.id === updated.id ? updated : conversation,
    ),
  );
}
