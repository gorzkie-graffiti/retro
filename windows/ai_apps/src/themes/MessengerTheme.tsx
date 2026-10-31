import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { formatClock } from "../lib/format";
import { previewText } from "../lib/conversations";
import { PlainText } from "../components/PlainText";
import { SettingsDialog, type SettingsDialogView } from "../components/SettingsDialog";
import { ThemeSelect } from "../components/ThemeSelect";
import type { ChatMessage } from "../types";
import type { ThemeShellProps } from "./types";

const EMOTICONS = [
  { glyph: ":-)", label: "smile" },
  { glyph: ";-)", label: "wink" },
  { glyph: ":-D", label: "grin" },
  { glyph: ":-(", label: "sad" },
  { glyph: ":-P", label: "tongue" },
  { glyph: ":-O", label: "surprised" },
  { glyph: ":-$", label: "embarrassed" },
  { glyph: "(H)", label: "cool" },
  { glyph: "(A)", label: "angel" },
  { glyph: "(6)", label: "devil" },
  { glyph: ":-|", label: "straight face" },
  { glyph: ":-*", label: "kiss" },
];

function senderName(message: ChatMessage): string {
  return message.role === "user" ? "Me" : "Gemini";
}

function conversationPreview(conversation: ThemeShellProps["conversations"][number]) {
  const last = [...conversation.messages]
    .reverse()
    .find((message) => message.content.trim() && !message.meta?.error);
  return last ? previewText(last.content, 38) : "No messages yet";
}

export function MessengerTheme({
  theme,
  onThemeChange,
  conversations,
  activeConversation,
  pendingConversationId,
  settings,
  models,
  connection,
  draft,
  onDraftChange,
  onSend,
  onStop,
  onRetry,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onClearAll,
  onModelChange,
  onApplySettings,
}: ThemeShellProps) {
  const [filter, setFilter] = useState("");
  const [dialogView, setDialogView] = useState<SettingsDialogView | null>(null);
  const [emoticonOpen, setEmoticonOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [nudgeNotice, setNudgeNotice] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousConversationId = useRef(activeConversation.id);
  const nudgeTimers = useRef<number[]>([]);

  const isBusy = pendingConversationId !== null;
  const isBusyHere = pendingConversationId === activeConversation.id;
  const isBusyElsewhere = isBusy && !isBusyHere;
  const lastMessage =
    activeConversation.messages[activeConversation.messages.length - 1];
  const canRetry = !isBusy && Boolean(lastMessage?.meta?.error);

  const backendName = settings.provider === "ai-studio" ? "Gemini API" : "local bridge";
  const statusText =
    connection.status === "online"
      ? `Online — ${backendName} ready`
      : connection.status === "checking"
        ? `Connecting to the ${backendName}…`
        : "Appears offline — check API settings";

  const needle = filter.trim().toLowerCase();
  const filteredConversations = conversations.filter((conversation) => {
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

  const optionList = models.some((option) => option.id === settings.model)
    ? models
    : [{ id: settings.model, description: "Current selection" }, ...models];

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [
    activeConversation.id,
    activeConversation.messages.length,
    isBusyHere,
  ]);

  useEffect(() => {
    if (previousConversationId.current === activeConversation.id) {
      return;
    }
    previousConversationId.current = activeConversation.id;
    const textarea = textareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(draft.length, draft.length);
  }, [activeConversation.id, draft.length]);

  useEffect(() => {
    return () => {
      nudgeTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function submit() {
    const content = draft.trim();
    if (!content || isBusy) {
      return;
    }
    onDraftChange("");
    onSend(content);
    textareaRef.current?.focus();
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") {
      setEmoticonOpen(false);
    }
  }

  function insertEmoticon(glyph: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const needsSpace = start > 0 && !/\s$/.test(draft.slice(0, start));
    const inserted = `${needsSpace ? " " : ""}${glyph} `;
    const next = draft.slice(0, start) + inserted + draft.slice(end);
    onDraftChange(next);
    setEmoticonOpen(false);
    window.requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }
      const cursor = start + inserted.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cursor, cursor);
    });
  }

  function sendNudge() {
    nudgeTimers.current.forEach((timer) => window.clearTimeout(timer));
    setNudging(false);
    setNudgeNotice(false);
    nudgeTimers.current = [
      window.setTimeout(() => {
        setNudging(true);
        setNudgeNotice(true);
      }, 10),
      window.setTimeout(() => setNudging(false), 720),
      window.setTimeout(() => setNudgeNotice(false), 2100),
    ];
  }

  return (
    <div className="msgr-app" data-theme="messenger">
      <div
        className={`msgr-frame${collapsed ? " msgr-frame--collapsed" : ""}${
          nudging ? " msgr-frame--nudged" : ""
        }`}
      >
        <div className="msgr-titlebar">
          <span aria-hidden="true" className="msgr-titlebar-gem">
            ◆
          </span>
          <span className="msgr-titlebar-title">Gemini Messenger</span>
          <span className="msgr-titlebar-beta">BETA</span>
          <span className="msgr-titlebar-spacer" />
          <span className="msgr-titlebar-status">
            <span
              aria-hidden="true"
              className={`msgr-status-dot msgr-status-dot--${connection.status}`}
            />
            {connection.status === "online" ? "Online" : connection.status}
          </span>
          <button
            aria-label={collapsed ? "Restore messenger window" : "Minimize messenger window"}
            className="msgr-window-button"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Restore" : "Minimize"}
            type="button"
          >
            {collapsed ? "▣" : "—"}
          </button>
        </div>

        {!collapsed ? (
          <>
            <div className="msgr-toolbar">
              <button
                className="msgr-tool-button"
                onClick={onNewConversation}
                type="button"
              >
                New
              </button>
              <button
                className="msgr-tool-button"
                onClick={() => setDialogView("connection")}
                type="button"
              >
                Settings
              </button>
              <button
                className="msgr-tool-button"
                onClick={() => setDialogView("help")}
                type="button"
              >
                Help
              </button>
              <span className="msgr-toolbar-divider" aria-hidden="true" />
              <label className="msgr-model">
                <span>Model:</span>
                <select
                  onChange={(event) => onModelChange(event.target.value)}
                  value={settings.model}
                >
                  {optionList.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="msgr-body">
              <aside aria-label="Contacts and conversations" className="msgr-sidebar">
                <div className="msgr-contact-card">
                  <div className="msgr-avatar" aria-hidden="true">
                    <span className="msgr-avatar-gem">◆</span>
                  </div>
                  <div className="msgr-contact-copy">
                    <div className="msgr-contact-name">
                      <span
                        aria-hidden="true"
                        className={`msgr-status-dot msgr-status-dot--${connection.status}`}
                      />
                      Gemini
                      <span className="msgr-contact-kind">AI</span>
                    </div>
                    <div
                      className={`msgr-contact-status msgr-contact-status--${connection.status}`}
                    >
                      {statusText}
                    </div>
                  </div>
                </div>

                <div className="msgr-sidebar-heading">
                  <span>Conversations</span>
                  <span className="msgr-count">{conversations.length}</span>
                </div>

                <div className="msgr-filter-row">
                  <label className="visually-hidden" htmlFor="msgr-filter">
                    Filter conversations
                  </label>
                  <input
                    id="msgr-filter"
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Find a conversation…"
                    type="search"
                    value={filter}
                  />
                </div>

                <div className="msgr-contact-list">
                  {filteredConversations.length === 0 ? (
                    <p className="msgr-list-empty">
                      No conversations match. Gemini chats you save appear here.
                    </p>
                  ) : (
                    <ul>
                      {filteredConversations.map((conversation) => {
                        const isActive = conversation.id === activeConversation.id;
                        const isPending = conversation.id === pendingConversationId;
                        return (
                          <li key={conversation.id}>
                            <div
                              className={`msgr-conversation${
                                isActive ? " msgr-conversation--active" : ""
                              }`}
                            >
                              <button
                                aria-current={isActive ? "true" : undefined}
                                className="msgr-conversation-open"
                                onClick={() => onSelectConversation(conversation.id)}
                                title={conversation.title}
                                type="button"
                              >
                                <span className="msgr-conversation-title">
                                  {isPending ? (
                                    <span
                                      aria-label="Gemini is replying"
                                      className="msgr-pending"
                                    >
                                      ●
                                    </span>
                                  ) : null}
                                  {conversation.title}
                                </span>
                                <span className="msgr-conversation-preview">
                                  {conversationPreview(conversation)}
                                </span>
                                <span className="msgr-conversation-time">
                                  {formatClock(conversation.updatedAt)}
                                </span>
                              </button>
                              <button
                                aria-label={`Delete conversation: ${conversation.title}`}
                                className="msgr-conversation-delete"
                                onClick={() => onDeleteConversation(conversation.id)}
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

                <div className="msgr-sidebar-footer">
                  <ThemeSelect
                    compact
                    onChange={onThemeChange}
                    value={theme}
                  />
                  <button
                    className="msgr-link-button msgr-clear-all"
                    disabled={conversations.every(
                      (conversation) => conversation.messages.length === 0,
                    )}
                    onClick={onClearAll}
                    type="button"
                  >
                    Clear all
                  </button>
                </div>
              </aside>

              <section className="msgr-chat" aria-label="Gemini conversation">
                <div className="msgr-chat-heading">
                  <span aria-hidden="true" className="msgr-chat-heading-gem">
                    ◆
                  </span>
                  <span className="msgr-chat-with">
                    To: <strong>Gemini</strong>
                  </span>
                  <span className="msgr-chat-hint">
                    {isBusyHere
                      ? "Waiting for a reply…"
                      : "Enter sends · Shift+Enter adds a line"}
                  </span>
                </div>

                {connection.status === "offline" ? (
                  <div className="msgr-warning" role="status">
                    <span aria-hidden="true">!</span>
                    <span>Gemini is not reachable. Check the API settings.</span>
                    <button
                      className="msgr-link-button"
                      onClick={() => setDialogView("connection")}
                      type="button"
                    >
                      Settings
                    </button>
                  </div>
                ) : null}

                <div
                  aria-label="Conversation history"
                  aria-live="polite"
                  className="msgr-transcript"
                  ref={transcriptRef}
                >
                  {activeConversation.messages.length === 0 ? (
                    <div className="msgr-welcome">
                      <div className="msgr-welcome-heading">
                        Gemini is online
                        <span className="msgr-blink" aria-hidden="true">
                          _
                        </span>
                      </div>
                      <p>
                        This is a real conversation through the{" "}
                        <strong>
                          {settings.provider === "ai-studio"
                            ? "Google Gemini API"
                            : "gemini-web2api bridge"}
                        </strong>
                        . Earlier turns are sent with each question so Gemini can
                        follow along.
                      </p>
                      <div className="msgr-quick-label">Try saying:</div>
                      {[
                        "Recommend a film for a rainy afternoon.",
                        "Explain what RSS meant in 2005.",
                      ].map((idea) => (
                        <button
                          className="msgr-quick-prompt"
                          key={idea}
                          onClick={() => {
                            onDraftChange(idea);
                            textareaRef.current?.focus();
                          }}
                          type="button"
                        >
                          “{idea}”
                        </button>
                      ))}
                      <p className="msgr-welcome-fine">
                        The contact list holds your saved chats, not simulated
                        friends.
                      </p>
                    </div>
                  ) : (
                    activeConversation.messages.map((message, index) => {
                      const isLast =
                        index === activeConversation.messages.length - 1;
                      return (
                        <div
                          className={`msgr-message msgr-message--${message.role}`}
                          key={message.id}
                        >
                          <div className="msgr-message-heading">
                            <span className="msgr-sender">
                              {senderName(message)}
                              {message.role === "assistant" ? " says:" : ":"}
                            </span>
                            <span className="msgr-message-time">
                              {formatClock(message.createdAt)}
                            </span>
                          </div>
                          {message.meta?.error ? (
                            <div className="msgr-error" role="alert">
                              <strong>
                                {message.meta.cancelled
                                  ? "Request cancelled"
                                  : "Message not delivered"}
                              </strong>
                              <p>{message.meta.error}</p>
                              {isLast && canRetry ? (
                                <button
                                  className="msgr-tool-button"
                                  onClick={onRetry}
                                  type="button"
                                >
                                  Retry
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <div className="msgr-message-body">
                              <PlainText content={message.content} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {isBusyHere ? (
                    <div className="msgr-typing" role="status">
                      <span className="msgr-typing-name">Gemini is typing</span>
                      <span aria-hidden="true" className="msgr-typing-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </div>
                  ) : null}
                </div>

                <form className="msgr-composer" onSubmit={handleFormSubmit}>
                  <div className="msgr-composer-tools">
                    <button
                      aria-expanded={emoticonOpen}
                      className="msgr-tool-button"
                      onClick={() => setEmoticonOpen((current) => !current)}
                      type="button"
                    >
                      <span aria-hidden="true" className="msgr-smile">
                        ☺
                      </span>
                      Emoticons
                    </button>
                    <button
                      className="msgr-tool-button"
                      onClick={sendNudge}
                      title="Shake the messenger window"
                      type="button"
                    >
                      <span aria-hidden="true" className="msgr-nudge-icon">
                        !
                      </span>
                      Nudge
                    </button>
                    {nudgeNotice ? (
                      <span className="msgr-nudge-notice" role="status">
                        You sent a nudge!
                      </span>
                    ) : null}
                    <span className="msgr-char-count">{draft.length}/12000</span>
                    {emoticonOpen ? (
                      <div
                        aria-label="Choose an emoticon"
                        className="msgr-emoticon-picker"
                        role="group"
                      >
                        {EMOTICONS.map((emoticon) => (
                          <button
                            key={emoticon.glyph}
                            onClick={() => insertEmoticon(emoticon.glyph)}
                            title={emoticon.label}
                            type="button"
                          >
                            <span aria-hidden="true">{emoticon.glyph}</span>
                            <span className="visually-hidden">{emoticon.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <textarea
                    aria-label="Message to Gemini"
                    disabled={isBusyElsewhere}
                    maxLength={12000}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isBusyElsewhere
                        ? "Gemini is replying in another chat…"
                        : "Type a message and press Enter…"
                    }
                    ref={textareaRef}
                    rows={3}
                    spellCheck
                    value={draft}
                  />

                  <div className="msgr-send-row">
                    <span className="msgr-composer-hint">
                      {isBusyElsewhere
                        ? "One request at a time."
                        : "Answers come from the live Gemini backend."}
                    </span>
                    {isBusyHere ? (
                      <button
                        className="msgr-send-button"
                        onClick={onStop}
                        type="button"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        className="msgr-send-button"
                        disabled={!draft.trim() || isBusyElsewhere}
                        type="submit"
                      >
                        Send
                      </button>
                    )}
                  </div>
                </form>
              </section>
            </div>

            <div className="msgr-statusbar">
              <span
                className={`msgr-status-cell msgr-status-cell--${connection.status}`}
              >
                <span className={`led led--${connection.status}`} aria-hidden="true" />
                {connection.status === "online"
                  ? "Connected"
                  : connection.status === "checking"
                    ? "Checking connection"
                    : "Disconnected"}
              </span>
              <span className="msgr-status-cell">
                {activeConversation.messages.length} message
                {activeConversation.messages.length === 1 ? "" : "s"}
              </span>
              <span className="msgr-status-cell msgr-status-cell--wide">
                {settings.baseUrl}
              </span>
              <span className="msgr-status-cell">History saved locally</span>
            </div>
          </>
        ) : null}
      </div>

      {dialogView ? (
        <SettingsDialog
          connection={connection}
          initialView={dialogView}
          models={models}
          onApplySettings={onApplySettings}
          onClose={() => setDialogView(null)}
          onModelChange={onModelChange}
          settings={settings}
          variant="messenger"
        />
      ) : null}
    </div>
  );
}
