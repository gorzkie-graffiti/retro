import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { formatClock, formatHistoryTime } from "../lib/format";
import { previewText } from "../lib/conversations";
import { PlainText } from "../components/PlainText";
import {
  SettingsDialog,
  type SettingsDialogView,
} from "../components/SettingsDialog";
import { ThemeSelect } from "../components/ThemeSelect";
import { PaperclipMascot } from "./PaperclipMascot";
import type { ThemeShellProps } from "./types";

const STARTER_QUESTIONS = [
  "How does a microwave oven heat food?",
  "What was the purpose of a 2003 PDA?",
];

export function AssistantTheme({
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

  const transcriptRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const previousConversationId = useRef(activeConversation.id);

  const isBusy = pendingConversationId !== null;
  const isBusyHere = pendingConversationId === activeConversation.id;
  const isBusyElsewhere = isBusy && !isBusyHere;
  const lastMessage =
    activeConversation.messages[activeConversation.messages.length - 1];
  const canRetry = !isBusy && Boolean(lastMessage?.meta?.error);

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
    const question = questionRef.current;
    question?.focus();
    question?.setSelectionRange(draft.length, draft.length);
  }, [activeConversation.id, draft.length]);

  function submit() {
    const content = draft.trim();
    if (!content || isBusy) {
      return;
    }
    onDraftChange("");
    onSend(content);
    questionRef.current?.focus();
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
  }

  function useStarter(question: string) {
    onDraftChange(question);
    questionRef.current?.focus();
  }

  return (
    <div className="win-app" data-theme="assistant">
      <div className="win-frame">
        <div className="win-titlebar">
          <span aria-hidden="true" className="win-titlebar-icon">
            ?
          </span>
          <span className="win-titlebar-title">
            Gemini Reference Assistant
          </span>
          <span className="win-titlebar-beta">98/XP EDITION</span>
          <span className="win-titlebar-spacer" />
          <span className="win-titlebar-note">Ask Gemini · BETA</span>
        </div>

        <div className="win-toolbar">
          <button
            className="win-button"
            onClick={onNewConversation}
            type="button"
          >
            New question
          </button>
          <button
            className="win-button"
            onClick={() => setDialogView("connection")}
            type="button"
          >
            Options…
          </button>
          <button
            className="win-button"
            onClick={() => setDialogView("help")}
            type="button"
          >
            Help
          </button>
          <span className="win-toolbar-divider" aria-hidden="true" />
          <label className="win-model">
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
          <span className="win-toolbar-spacer" />
          <ThemeSelect compact onChange={onThemeChange} value={theme} />
        </div>

        <div className="win-frame-body">
          <aside aria-label="Question index" className="win-index">
            <div className="win-index-heading">Question Index</div>
            <label className="visually-hidden" htmlFor="win-index-filter">
              Filter saved questions
            </label>
            <input
              className="win-index-filter"
              id="win-index-filter"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find a topic…"
              type="search"
              value={filter}
            />
            <div className="win-index-list">
              {filteredConversations.length === 0 ? (
                <p className="win-index-empty">
                  No saved questions match this filter.
                </p>
              ) : (
                <ul>
                  {filteredConversations.map((conversation) => {
                    const isActive = conversation.id === activeConversation.id;
                    const isPending = conversation.id === pendingConversationId;
                    return (
                      <li key={conversation.id}>
                        <div
                          className={`win-index-row${
                            isActive ? " win-index-row--active" : ""
                          }`}
                        >
                          <button
                            aria-current={isActive ? "true" : undefined}
                            className="win-index-open"
                            onClick={() => onSelectConversation(conversation.id)}
                            title={conversation.title}
                            type="button"
                          >
                            <span className="win-index-title">
                              {isPending ? (
                                <span
                                  aria-label="Waiting for Gemini"
                                  className="win-index-pending"
                                >
                                  ●
                                </span>
                              ) : (
                                <span aria-hidden="true" className="win-index-bullet">
                                  ▸
                                </span>
                              )}
                              {conversation.title}
                            </span>
                            <span className="win-index-meta">
                              {formatHistoryTime(conversation.updatedAt)}
                            </span>
                          </button>
                          <button
                            aria-label={`Delete question: ${conversation.title}`}
                            className="win-index-delete"
                            onClick={() => onDeleteConversation(conversation.id)}
                            title="Delete this question"
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
            <div className="win-index-footer">
              <button className="win-button" onClick={onNewConversation} type="button">
                New
              </button>
              <button
                className="win-button"
                disabled={conversations.every(
                  (conversation) => conversation.messages.length === 0,
                )}
                onClick={onClearAll}
                type="button"
              >
                Clear
              </button>
            </div>
          </aside>

          <main className="win-main">
            <form className="win-ask-form" onSubmit={handleFormSubmit}>
              <label htmlFor="win-question">
                Search the reference desk or ask a question
              </label>
              <div className="win-ask-row">
                <span aria-hidden="true" className="win-ask-icon">
                  🔍
                </span>
                <textarea
                  aria-label="Question for Gemini"
                  disabled={isBusyElsewhere}
                  id="win-question"
                  maxLength={12000}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isBusyElsewhere
                      ? "A reply is still being generated in another question…"
                      : "What would you like to know?"
                  }
                  ref={questionRef}
                  rows={2}
                  spellCheck
                  value={draft}
                />
                <button
                  className="win-button win-ask-button"
                  disabled={!draft.trim() || isBusyElsewhere || isBusyHere}
                  type="submit"
                >
                  Ask Gemini
                </button>
                {isBusyHere ? (
                  <button className="win-button" onClick={onStop} type="button">
                    Stop
                  </button>
                ) : null}
              </div>
              <div className="win-ask-hint">
                <span>Enter asks · Shift+Enter adds a line</span>
                {connection.status !== "online" ? (
                  <button
                    className="win-link-button"
                    onClick={() => setDialogView("connection")}
                    type="button"
                  >
                    {connection.status === "checking"
                      ? "Checking the backend…"
                      : "Backend offline — open Options"}
                  </button>
                ) : (
                  <span className="win-ask-online">
                    <span className="led led--online" aria-hidden="true" />
                    {settings.provider === "ai-studio"
                      ? "Gemini API connected"
                      : "Local bridge connected"}
                  </span>
                )}
              </div>
            </form>

            {isBusyHere ? (
              <div className="win-progress-row" role="status">
                <span className="win-progress" aria-hidden="true">
                  <span />
                </span>
                <span>Searching the encyclopedia through Gemini…</span>
              </div>
            ) : null}

            <div
              aria-label="Gemini reference results"
              aria-live="polite"
              className="win-results"
              ref={transcriptRef}
            >
              {activeConversation.messages.length === 0 ? (
                <div className="win-welcome">
                  <div className="win-welcome-heading">
                    Welcome to the Gemini Reference Desk
                  </div>
                  <p>
                    Type a question above and press <strong>Ask Gemini</strong>.
                    Real answers arrive through your configured Gemini backend
                    and are kept in this browser.
                  </p>
                  <div className="win-welcome-label">Suggested starting points:</div>
                  {STARTER_QUESTIONS.map((question) => (
                    <button
                      className="win-topic-link"
                      key={question}
                      onClick={() => useStarter(question)}
                      type="button"
                    >
                      {question}
                    </button>
                  ))}
                  <p className="win-welcome-fine">
                    Answers use safe Markdown formatting. Code appears in simple
                    preformatted boxes; model HTML is never executed.
                  </p>
                </div>
              ) : (
                activeConversation.messages.map((message, index) => {
                  const isLast =
                    index === activeConversation.messages.length - 1;
                  if (message.role === "user") {
                    return (
                      <section className="win-question-block" key={message.id}>
                        <div className="win-block-label">You asked</div>
                        <PlainText content={message.content} />
                      </section>
                    );
                  }

                  return (
                    <section className="win-answer-block" key={message.id}>
                      <div className="win-answer-heading">
                        <span className="win-answer-title">Gemini's answer</span>
                        <span className="win-answer-meta">
                          {message.meta?.model ?? settings.model} ·{" "}
                          {formatClock(message.createdAt)}
                        </span>
                      </div>
                      {message.meta?.error ? (
                        <div className="win-error" role="alert">
                          <strong>
                            {message.meta.cancelled
                              ? "The search was cancelled."
                              : "Gemini could not answer."}
                          </strong>
                          <p>{message.meta.error}</p>
                          {isLast && canRetry ? (
                            <button
                              className="win-button"
                              onClick={onRetry}
                              type="button"
                            >
                              Retry
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="win-answer-body">
                          <PlainText content={message.content} />
                        </div>
                      )}
                    </section>
                  );
                })
              )}
              {isBusyHere ? (
                <div className="win-searching">
                  <span aria-hidden="true" className="win-hourglass">
                    ⌛
                  </span>
                  Gemini is searching its knowledge…
                </div>
              ) : null}
            </div>

            <div className="win-results-footer">
              <span>
                {activeConversation.messages.length === 0
                  ? "No question yet"
                  : `${activeConversation.messages.length} message${
                      activeConversation.messages.length === 1 ? "" : "s"
                    } in this topic`}
              </span>
              <span title={activeConversation.title}>
                Topic:{" "}
                {previewText(
                  activeConversation.title,
                  44,
                )}
              </span>
              <span>{settings.baseUrl}</span>
            </div>
          </main>

          <PaperclipMascot />
        </div>

        <div className="win-statusbar">
          <span className={`win-status-pane win-status-pane--${connection.status}`}>
            <span className={`led led--${connection.status}`} aria-hidden="true" />
            {connection.status === "online"
              ? settings.provider === "ai-studio"
                ? "Connected to Gemini API"
                : "Connected to Gemini bridge"
              : connection.status === "checking"
                ? "Checking connection…"
                : "Backend offline"}
          </span>
          <span className="win-status-pane">
            {conversations.length} saved question
            {conversations.length === 1 ? "" : "s"}
          </span>
          <span className="win-status-pane win-status-pane--wide">
            {connection.message}
          </span>
          <span className="win-status-pane">Local history</span>
        </div>
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
          variant="assistant"
        />
      ) : null}
    </div>
  );
}
