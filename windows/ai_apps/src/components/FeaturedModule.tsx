import { latestAssistantAnswer, previewText } from "../lib/conversations";
import { formatClock, formatDuration } from "../lib/format";
import type { Conversation } from "../types";
import { PlainText } from "./PlainText";

interface FeaturedModuleProps {
  conversation: Conversation | null;
  onOpenChat: () => void;
}

export function FeaturedModule({
  conversation,
  onOpenChat,
}: FeaturedModuleProps) {
  const answer = latestAssistantAnswer(conversation);

  return (
    <div className="featured-shell">
      <div className="featured-ribbon">
        <span aria-hidden="true">★</span> Featured answer · latest reply
      </div>
      {answer ? (
        <>
          <div className="featured-body">
            <div className="featured-context">
              From <strong>{conversation?.title}</strong>
            </div>
            <div className="featured-answer">
              <PlainText content={answer.content} />
            </div>
          </div>
          <div className="featured-footer">
            <span className="featured-meta">
              {answer.meta?.model ?? conversation?.model ?? "Gemini"} ·{" "}
              {formatClock(answer.createdAt)}
              {answer.meta?.durationMs !== undefined
                ? ` · ${formatDuration(answer.meta.durationMs)}`
                : ""}
            </span>
            <button className="btn btn-small" onClick={onOpenChat} type="button">
              Open chat »
            </button>
          </div>
        </>
      ) : (
        <div className="featured-empty">
          <div aria-hidden="true" className="featured-empty-gem">
            ◆
          </div>
          <strong>No featured answer yet.</strong>
          <p>
            The most recent real Gemini response will be clipped here for quick
            reading. Nothing is pre-filled or simulated.
          </p>
          {conversation && conversation.messages.length > 0 ? (
            <p className="featured-empty-small">
              Last prompt: “{previewText(
                [...conversation.messages]
                  .reverse()
                  .find((message) => message.role === "user")?.content ??
                  "No prompt yet",
                64,
              )}”
            </p>
          ) : null}
          <button className="btn btn-small" onClick={onOpenChat} type="button">
            Go to chat »
          </button>
        </div>
      )}
    </div>
  );
}
