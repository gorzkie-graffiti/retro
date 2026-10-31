import { describe, expect, it } from "vitest";
import {
  appendMessage,
  deriveTitle,
  latestAssistantAnswer,
  newConversation,
  newMessage,
  parseConversations,
  toApiMessages,
} from "./conversations";
import type { Conversation } from "../types";

function sampleConversation(): Conversation {
  return {
    id: "conv-1",
    title: "My name",
    model: "gemini-3.6-flash",
    createdAt: 1000,
    updatedAt: 1000,
    messages: [
      {
        id: "m1",
        role: "user",
        content: "My name is Ada.",
        createdAt: 1000,
      },
      {
        id: "m2",
        role: "assistant",
        content: "Nice to meet you, Ada.",
        createdAt: 1100,
        meta: { model: "gemini-3.6-flash" },
      },
    ],
  };
}

describe("deriveTitle", () => {
  it("collapses whitespace and trims", () => {
    expect(deriveTitle("  Explain   RSS feeds\nplease ")).toBe(
      "Explain RSS feeds please",
    );
  });

  it("truncates long prompts at a word boundary", () => {
    const title = deriveTitle(
      "Please explain in careful detail how a 2008 RSS reader fetched feeds over HTTP",
    );
    expect(title.length).toBeLessThanOrEqual(52);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back for blank content", () => {
    expect(deriveTitle("   \n ")).toBe("New conversation");
  });
});

describe("conversation history", () => {
  it("appends messages, derives the title from the first user turn, and updates time", () => {
    const conversation = newConversation("gemini-3.6-flash", 1000);
    const updated = appendMessage(
      conversation,
      newMessage("user", "Plan a weekend in Prague"),
    );
    expect(updated.title).toBe("Plan a weekend in Prague");
    expect(updated.messages).toHaveLength(1);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(1000);
  });

  it("resends prior turns and excludes error placeholders", () => {
    const conversation = sampleConversation();
    const withError = appendMessage(
      conversation,
      newMessage("assistant", "", { error: "Bridge offline" }),
    );
    const payload = toApiMessages(withError);
    expect(payload).toEqual([
      { role: "user", content: "My name is Ada." },
      { role: "assistant", content: "Nice to meet you, Ada." },
    ]);
  });

  it("finds the latest genuine assistant answer", () => {
    const conversation = appendMessage(
      sampleConversation(),
      newMessage("assistant", "", { error: "Nope" }),
    );
    expect(latestAssistantAnswer(conversation)?.content).toBe(
      "Nice to meet you, Ada.",
    );
  });

  it("returns null when no genuine answer exists", () => {
    expect(latestAssistantAnswer(null)).toBeNull();
    expect(latestAssistantAnswer(newConversation("gemini-3.6-flash"))).toBeNull();
  });
});

describe("parseConversations", () => {
  it("rejects malformed entries and sorts newest first", () => {
    const parsed = parseConversations([
      {
        ...sampleConversation(),
        id: "conv-old",
        updatedAt: 500,
      },
      {
        ...sampleConversation(),
        id: "conv-new",
        updatedAt: 2000,
      },
      { id: 4, title: "broken" },
      {
        ...sampleConversation(),
        id: "conv-bad-message",
        messages: [{ role: "system", content: "ignored", id: 1 }],
      },
    ]);

    expect(parsed.map((conversation) => conversation.id)).toEqual([
      "conv-new",
      "conv-bad-message",
      "conv-old",
    ]);
    expect(
      parsed.find((conversation) => conversation.id === "conv-bad-message")
        ?.messages,
    ).toEqual([]);
  });

  it("returns an empty list for non-arrays or invalid JSON values", () => {
    expect(parseConversations(null)).toEqual([]);
    expect(parseConversations({ conversations: [] })).toEqual([]);
  });
});
