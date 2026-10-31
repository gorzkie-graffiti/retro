import { countUserMessages, previewText } from "../lib/conversations";
import { formatHistoryTime } from "../lib/format";
import type { Conversation } from "../types";

interface HistoryModuleProps {
  conversations: Conversation[];
  activeId: string;
  pendingConversationId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewConversation: () => void;
  onClearAll: () => void;
}

function conversationSnippet(conversation: Conversation): string {
  const answer = [...conversation.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        !message.meta?.error &&
        message.content.trim(),
    );
  if (answer) {
    return previewText(answer.content, 72);
  }
  const userMessage = conversation.messages.find(
    (message) => message.role === "user",
  );
  if (userMessage) {
    return previewText(userMessage.content, 72);
  }
  return "Empty conversation";
}

export function HistoryModule({
  conversations,
  activeId,
  pendingConversationId,
  query,
  onQueryChange,
  onSelect,
  onDelete,
  onNewConversation,
  onClearAll,
}: HistoryModuleProps) {
  const needle = query.trim().toLowerCase();
  const filtered = conversations.filter((conversation) => {
    if (!needle) {
      return true;
    }
    return (
      conversation.title.toLowerCase().includes(needle) ||
      conversation.messages.some((message) =>
        message.content.toLowerCase().includes(needle),
      )
    );
  });

  return (
    <div className="history-shell">
      <div className="history-filter">
        <label className="visually-hidden" htmlFor="history-filter-input">
          Filter saved conversations
        </label>
        <input
          id="history-filter-input"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter conversations…"
          type="search"
          value={query}
        />
        {query ? (
          <button
            className="link-button"
            onClick={() => onQueryChange("")}
            type="button"
          >
            clear
          </button>
        ) : (
          <span className="filter-hint">title or text</span>
        )}
      </div>

      <div className="history-list-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state empty-state--history">
            <div aria-hidden="true" className="empty-glyph">
              ☰
            </div>
            <strong>
              {conversations.length === 0
                ? "No saved conversations yet."
                : "No conversations match that search."}
            </strong>
            <p>
              {conversations.length === 0
                ? "Ask Gemini a question and it will appear here automatically."
                : "Try a different word, or clear the filter."}
            </p>
          </div>
        ) : (
          <ul className="conversation-list">
            {filtered.map((conversation) => {
              const isActive = conversation.id === activeId;
              const isPending =
                conversation.id === pendingConversationId;
              return (
                <li key={conversation.id}>
                  <div
                    className={`conversation-row${
                      isActive ? " conversation-row--active" : ""
                    }`}
                  >
                    <button
                      aria-current={isActive ? "true" : undefined}
                      className="conversation-open"
                      onClick={() => onSelect(conversation.id)}
                      title={conversation.title}
                      type="button"
                    >
                      <span className="conversation-title">
                        {isPending ? (
                          <span
                            aria-label="Waiting for Gemini"
                            className="pending-mark"
                            title="Waiting for Gemini"
                          >
                            ●
                          </span>
                        ) : (
                          <span aria-hidden="true" className="conversation-bullet">
                            ▸
                          </span>
                        )}
                        {conversation.title}
                      </span>
                      <span className="conversation-snippet">
                        {conversationSnippet(conversation)}
                      </span>
                      <span className="conversation-meta">
                        {conversation.model} ·{" "}
                        {countUserMessages(conversation)} question
                        {countUserMessages(conversation) === 1 ? "" : "s"} ·{" "}
                        {formatHistoryTime(conversation.updatedAt)}
                      </span>
                    </button>
                    <button
                      aria-label={`Delete conversation: ${conversation.title}`}
                      className="conversation-delete"
                      data-tip="Delete this conversation"
                      onClick={() => onDelete(conversation.id)}
                      title="Delete this conversation"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="history-footer">
        <button
          className="btn btn-small"
          onClick={onNewConversation}
          type="button"
        >
          + New conversation
        </button>
        <span className="history-saved-note">
          {conversations.length} saved · local
        </span>
        <button
          className="link-button link-button--danger"
          disabled={conversations.every(
            (conversation) => conversation.messages.length === 0,
          )}
          onClick={onClearAll}
          title="Delete every saved conversation from this browser"
          type="button"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
