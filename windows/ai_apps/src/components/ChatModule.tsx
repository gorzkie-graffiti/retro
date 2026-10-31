import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { GEMINI } from "../data";
import type {
  ChatMessage,
  ConnectionStatus,
  Conversation,
  ModelInfo,
} from "../types";
import { formatClock, formatDuration } from "../lib/format";
import { PlainText } from "./PlainText";
import { ProgressBar, Spinner } from "./Spinner";

interface ChatModuleProps {
  conversation: Conversation;
  model: string;
  models: ModelInfo[];
  connectionStatus: ConnectionStatus;
  isBusyHere: boolean;
  isBusyElsewhere: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (content: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onNewConversation: () => void;
  onModelChange: (model: string) => void;
  onOpenSettings: () => void;
}

const EXAMPLE_PROMPTS = [
  "Explain RSS feeds to someone who just discovered blogs.",
  "Plan a cheap three-day trip to Vienna.",
  "Write a polite email asking my landlord to fix the heat.",
];

function messageMetaLine(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.role === "assistant" && message.meta?.model) {
    parts.push(message.meta.model);
  }
  if (message.meta?.durationMs !== undefined) {
    parts.push(formatDuration(message.meta.durationMs));
  }
  parts.push(formatClock(message.createdAt));
  return parts.join(" · ");
}

export function ChatModule({
  conversation,
  model,
  models,
  connectionStatus,
  isBusyHere,
  isBusyElsewhere,
  draft,
  onDraftChange,
  onSend,
  onStop,
  onRetry,
  onNewConversation,
  onModelChange,
  onOpenSettings,
}: ChatModuleProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const previousConversationId = useRef(conversation.id);

  useEffect(() => {
    if (previousConversationId.current !== conversation.id) {
      previousConversationId.current = conversation.id;
      composerRef.current?.focus();
    }
  }, [conversation.id]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [conversation.messages.length, isBusyHere]);

  useEffect(() => {
    if (!isBusyHere) {
      setElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isBusyHere]);

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const canRetry =
    !isBusyHere &&
    !isBusyElsewhere &&
    lastMessage?.role === "assistant" &&
    Boolean(lastMessage.meta?.error);

  const optionList = models.some((option) => option.id === model)
    ? models
    : [{ id: model, description: "Current selection" }, ...models];

  function submit() {
    const content = draft.trim();
    if (!content || isBusyHere || isBusyElsewhere) {
      return;
    }
    onDraftChange("");
    onSend(content);
    composerRef.current?.focus();
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  function useIdea(idea: string) {
    onDraftChange(idea);
    composerRef.current?.focus();
  }

  return (
    <div className="chat-shell">
      <div className="chat-toolbar">
        <label className="toolbar-model-label" htmlFor="chat-model">
          Model
        </label>
        <select
          className="model-select"
          id="chat-model"
          onChange={(event) => onModelChange(event.target.value)}
          value={model}
        >
          {optionList.map((option) => (
            <option key={option.id} value={option.id}>
              {option.id}
            </option>
          ))}
        </select>
        <span className="toolbar-separator" aria-hidden="true" />
        <button
          className="btn btn-small"
          data-tip="Start a fresh conversation"
          onClick={onNewConversation}
          title="Start a fresh conversation"
          type="button"
        >
          + New chat
        </button>
        <span className="toolbar-hint">
          {conversation.messages.length === 0
            ? "No messages yet"
            : `${conversation.messages.length} message${
                conversation.messages.length === 1 ? "" : "s"
              }`}
        </span>
      </div>

      {connectionStatus === "offline" ? (
        <div className="chat-warning">
          <span aria-hidden="true">⚠</span>
          <span>
            The Gemini backend is not reachable. Requests may fail.
          </span>
          <button className="link-button" onClick={onOpenSettings} type="button">
            API settings
          </button>
        </div>
      ) : null}

      {isBusyHere ? (
        <div className="chat-progress" role="status">
          <div className="chat-progress-copy">
            <Spinner />
            <strong>Gemini is thinking…</strong>
            <span className="wait-time">{elapsedSeconds}s</span>
            <button className="btn btn-small" onClick={onStop} type="button">
              Stop
            </button>
          </div>
          <ProgressBar label="Waiting for a Gemini response" />
        </div>
      ) : null}

      <div
        aria-label="Conversation transcript"
        aria-live="polite"
        className="chat-transcript"
        ref={transcriptRef}
      >
        {conversation.messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="welcome-card">
              <div className="welcome-kicker">Welcome to your personalized page</div>
              <h3>Ask Gemini anything.</h3>
              <p>
                A real answer appears here, sent through your{" "}
                <strong>configured Gemini backend</strong>. Each turn includes
                the earlier conversation so Gemini can follow along.
              </p>
              <div className="example-ideas">
                <span className="example-label">Try a question:</span>
                {EXAMPLE_PROMPTS.map((idea) => (
                  <button
                    className="example-link"
                    key={idea}
                    onClick={() => useIdea(idea)}
                    type="button"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
            <div className="welcome-tip">
              <span aria-hidden="true">✦</span> Tip: press <kbd>Enter</kbd> to
              send and <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line.
            </div>
          </div>
        ) : (
          conversation.messages.map((message, index) => {
            const isLast = index === conversation.messages.length - 1;
            if (message.role === "user") {
              return (
                <div className="message message--user" key={message.id}>
                  <div className="message-heading">
                    <span className="message-author">You</span>
                    <span className="message-meta">
                      {formatClock(message.createdAt)}
                    </span>
                  </div>
                  <PlainText content={message.content} />
                </div>
              );
            }

            return (
              <div className="message message--assistant" key={message.id}>
                <div className="message-heading">
                  <span className="message-author message-author--gemini">
                    <span aria-hidden="true" className="mini-gem">
                      ◆
                    </span>
                    Gemini
                  </span>
                  <span className="message-meta">{messageMetaLine(message)}</span>
                </div>
                {message.meta?.error ? (
                  <div className="error-box" role="alert">
                    <div className="error-title">
                      {message.meta.cancelled
                        ? "Request cancelled"
                        : "Could not get a reply"}
                    </div>
                    <p>{message.meta.error}</p>
                    {isLast && canRetry ? (
                      <button
                        className="btn btn-small"
                        onClick={onRetry}
                        type="button"
                      >
                        ↻ Retry this question
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <PlainText content={message.content} />
                )}
              </div>
            );
          })
        )}

        {isBusyHere ? (
          <div className="message message--assistant message--waiting">
            <div className="message-heading">
              <span className="message-author message-author--gemini">
                <span aria-hidden="true" className="mini-gem">
                  ◆
                </span>
                Gemini
              </span>
              <span className="message-meta">fetching answer…</span>
            </div>
            <div className="waiting-line">
              <Spinner small />
              <span>
                Contacting Gemini and waiting for the answer…
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <form className="chat-composer" onSubmit={handleFormSubmit}>
        <div className="composer-heading">
          <label htmlFor="chat-input">
            Your message to Gemini{" "}
            <span className="composer-note">
              (Enter sends · Shift+Enter makes a new line)
            </span>
          </label>
          <span className="composer-count">{draft.length} chars</span>
        </div>
        <textarea
          aria-describedby="composer-help"
          disabled={isBusyElsewhere}
          id="chat-input"
          maxLength={12000}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={
            isBusyElsewhere
              ? "A reply is still being generated in another conversation…"
              : "Ask a question, paste a draft, or think out loud…"
          }
          ref={composerRef}
          rows={3}
          spellCheck
          value={draft}
        />
        <div className="composer-actions">
          <span className="composer-help" id="composer-help">
            {isBusyElsewhere
              ? "One request at a time in this beta."
              : GEMINI.composerHelp}
          </span>
          <div className="composer-buttons">
            {isBusyHere ? (
              <button className="btn" onClick={onStop} type="button">
                Stop request
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={!draft.trim() || isBusyElsewhere}
                title="Send your message to Gemini"
                type="submit"
              >
                Send »
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
