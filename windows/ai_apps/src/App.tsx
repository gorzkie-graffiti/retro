import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkConnection,
  friendlyErrorMessage,
  GeminiApiError,
  sendChat,
  type ApiMessage,
} from "./api/geminiClient";
import { ChatModule } from "./components/ChatModule";
import { ConnectionModule } from "./components/ConnectionModule";
import { FeaturedModule } from "./components/FeaturedModule";
import { HelpModule } from "./components/HelpModule";
import { HistoryModule } from "./components/HistoryModule";
import { Masthead } from "./components/Masthead";
import { ThemeSelect } from "./components/ThemeSelect";
import { Dashboard, type DashboardModule } from "./dashboard/Dashboard";
import type { ModuleId } from "./dashboard/moduleLayout";
import {
  appendMessage,
  mergeConversation,
  newConversation,
  newMessage,
  parseConversations,
  sortConversations,
  toApiMessages,
} from "./lib/conversations";
import { formatLongDate } from "./lib/format";
import {
  defaultModel,
  fallbackModels,
  loadSettings,
  normalizeSettings,
  PROVIDER_SHORT,
  saveSettings as persistSettings,
} from "./lib/settings";
import { readJson, readString, STORAGE_KEYS, writeJson, writeString } from "./lib/storage";
import { applyThemeToDocument, loadTheme, saveTheme } from "./lib/theme";
import { AssistantTheme } from "./themes/AssistantTheme";
import { MessengerTheme } from "./themes/MessengerTheme";
import type { ThemeShellProps } from "./themes/types";
import type {
  AppTheme,
  ConnectionState,
  Conversation,
  GeminiSettings,
  ModelInfo,
} from "./types";

function loadStoredConversations(): Conversation[] {
  return parseConversations(
    readJson<unknown>(STORAGE_KEYS.conversations, []),
  );
}

function updateConversation(
  conversations: Conversation[],
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): Conversation[] {
  const target = conversations.find(
    (conversation) => conversation.id === conversationId,
  );
  if (!target) {
    return conversations;
  }
  return mergeConversation(conversations, updater(target));
}

export default function App() {
  const initial = useMemo(() => {
    const stored = loadStoredConversations();
    const conversations = stored.length
      ? stored
      : [newConversation(loadSettings().model)];
    const storedActiveId = readString(STORAGE_KEYS.activeConversation);
    const activeId = conversations.some(
      (conversation) => conversation.id === storedActiveId,
    )
      ? (storedActiveId as string)
      : conversations[0].id;
    return { conversations, activeId };
  }, []);

  const [settings, setSettings] = useState<GeminiSettings>(() =>
    loadSettings(),
  );
  const [conversations, setConversations] = useState<Conversation[]>(
    initial.conversations,
  );
  const [activeId, setActiveId] = useState(initial.activeId);
  const [models, setModels] = useState<ModelInfo[]>(() =>
    fallbackModels(settings.provider),
  );
  const [connection, setConnection] = useState<ConnectionState>({
    status: "checking",
    message: "Checking the configured Gemini backend…",
    checkedAt: null,
  });
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null
  >(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [theme, setTheme] = useState<AppTheme>(() => loadTheme());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const connectionSequence = useRef(0);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ??
    conversations[0] ??
    null;

  useEffect(() => {
    writeJson(STORAGE_KEYS.conversations, conversations);
  }, [conversations]);

  useEffect(() => {
    writeString(STORAGE_KEYS.activeConversation, activeId);
  }, [activeId]);

  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  useEffect(() => {
    applyThemeToDocument(theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function runConnectionCheck(target: GeminiSettings) {
    const sequence = ++connectionSequence.current;
    setConnection({
      status: "checking",
      message: `Contacting ${target.baseUrl}…`,
      checkedAt: null,
    });

    const backend = target.provider === "ai-studio" ? "Gemini API" : "Bridge";

    try {
      const result = await checkConnection(target);
      if (sequence !== connectionSequence.current) {
        return;
      }
      if (result.models.length > 0) {
        setModels(result.models);
      }
      setConnection({
        status: "online",
        message:
          result.models.length > 0
            ? `${backend} reachable. ${result.models.length} supported models found.`
            : `${backend} reachable, but it returned no model list; using documented models.`,
        checkedAt: result.checkedAt,
        latencyMs: result.latencyMs,
        modelCount: result.models.length,
      });
    } catch (error) {
      if (sequence !== connectionSequence.current) {
        return;
      }
      setConnection({
        status: "offline",
        message: friendlyErrorMessage(error),
        checkedAt: Date.now(),
      });
    }
  }

  useEffect(() => {
    // Run once on mount; later checks happen after settings are saved.
    void runConnectionCheck(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplySettings(next: GeminiSettings) {
    const normalized = normalizeSettings({
      ...next,
      baseUrl: next.baseUrl.trim().replace(/\/+$/, ""),
      apiKey: next.apiKey.trim(),
      model: next.model.trim() || defaultModel(next.provider),
    });
    const providerChanged = normalized.provider !== settings.provider;
    setSettings(normalized);
    if (providerChanged) {
      setModels(fallbackModels(normalized.provider));
    }
    void runConnectionCheck(normalized);
  }

  function handleModelChange(model: string) {
    setSettings((current) => ({ ...current, model }));
  }

  async function requestAssistant(
    conversationId: string,
    apiMessages: ApiMessage[],
    requestSettings: GeminiSettings,
  ) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setPendingConversationId(conversationId);

    try {
      const result = await sendChat(requestSettings, apiMessages, {
        signal: controller.signal,
      });
      const reply = newMessage("assistant", result.content, {
        model: result.model,
        durationMs: result.durationMs,
      });
      setConversations((current) =>
        updateConversation(current, conversationId, (conversation) =>
          appendMessage(conversation, reply),
        ),
      );
      setConnection((current) => ({
        status: "online",
        message: `A live answer was received from ${result.model}.`,
        checkedAt: Date.now(),
        latencyMs: current.latencyMs,
        modelCount: current.modelCount ?? models.length,
      }));
    } catch (error) {
      const cancelled =
        error instanceof GeminiApiError && error.kind === "aborted";
      const message = cancelled
        ? "Request cancelled. Press Retry to ask Gemini again."
        : friendlyErrorMessage(error);
      const failure = newMessage("assistant", "", {
        model: requestSettings.model,
        error: message,
        ...(cancelled ? { cancelled: true } : {}),
      });
      setConversations((current) =>
        updateConversation(current, conversationId, (conversation) =>
          appendMessage(conversation, failure),
        ),
      );
      if (!cancelled) {
        setConnection((current) => ({
          ...current,
          status: "offline",
          message: `Last request failed: ${message}`,
          checkedAt: Date.now(),
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      busyRef.current = false;
      setPendingConversationId(null);
    }
  }

  function handleDraftChange(value: string) {
    if (!activeConversation) {
      return;
    }
    setDrafts((current) => ({ ...current, [activeConversation.id]: value }));
  }

  function handleSend(rawContent: string) {
    const content = rawContent.trim();
    if (!content || busyRef.current) {
      return;
    }

    const baseConversation =
      activeConversation ?? newConversation(settings.model);
    const withUserMessage = appendMessage(
      { ...baseConversation, model: settings.model },
      newMessage("user", content),
    );

    setDrafts((current) => ({ ...current, [baseConversation.id]: "" }));
    setConversations((current) => {
      const exists = current.some(
        (conversation) => conversation.id === withUserMessage.id,
      );
      return exists
        ? mergeConversation(current, withUserMessage)
        : sortConversations([withUserMessage, ...current]);
    });
    setActiveId(withUserMessage.id);
    setHistoryQuery("");

    const apiMessages = toApiMessages(withUserMessage);
    if (apiMessages.length === 0) {
      return;
    }
    void requestAssistant(withUserMessage.id, apiMessages, settings);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleRetry() {
    const conversation = activeConversation;
    if (!conversation || busyRef.current) {
      return;
    }
    const lastMessage =
      conversation.messages[conversation.messages.length - 1];
    if (
      !lastMessage ||
      lastMessage.role !== "assistant" ||
      !lastMessage.meta?.error
    ) {
      return;
    }

    const trimmed: Conversation = {
      ...conversation,
      model: settings.model,
      messages: conversation.messages.slice(0, -1),
    };
    setConversations((current) =>
      updateConversation(current, conversation.id, () => trimmed),
    );

    const apiMessages = toApiMessages(trimmed);
    if (apiMessages.length === 0) {
      return;
    }
    void requestAssistant(conversation.id, apiMessages, settings);
  }

  function handleNewConversation() {
    const blank = newConversation(settings.model);
    setConversations((current) => [
      blank,
      ...current.filter((conversation) => conversation.messages.length > 0),
    ]);
    setActiveId(blank.id);
    setHistoryQuery("");
  }

  function handleSelectConversation(id: string) {
    setActiveId(id);
  }

  function handleDeleteConversation(id: string) {
    const target = conversations.find((conversation) => conversation.id === id);
    if (!target) {
      return;
    }
    const confirmed = window.confirm(
      `Delete “${target.title}” from this browser? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    if (pendingConversationId === id) {
      abortRef.current?.abort();
    }

    const remaining = conversations.filter(
      (conversation) => conversation.id !== id,
    );
    if (remaining.length === 0) {
      const blank = newConversation(settings.model);
      setConversations([blank]);
      setActiveId(blank.id);
    } else {
      setConversations(remaining);
      if (activeId === id) {
        setActiveId(remaining[0].id);
      }
    }
  }

  function handleClearAll() {
    const confirmed = window.confirm(
      "Clear every saved conversation from this browser? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    if (pendingConversationId) {
      abortRef.current?.abort();
    }
    const blank = newConversation(settings.model);
    setConversations([blank]);
    setActiveId(blank.id);
    setHistoryQuery("");
    setDrafts({});
  }

  function scrollToModule(id: ModuleId | "top") {
    if (id === "top") {
      document.getElementById("top")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    document
      .getElementById(`module-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleHistorySearchSubmit() {
    scrollToModule("history");
    window.setTimeout(() => {
      document.getElementById("history-filter-input")?.focus();
    }, 250);
  }

  const isBusy = pendingConversationId !== null;
  const isBusyHere =
    activeConversation !== null &&
    pendingConversationId === activeConversation.id;

  const modules: Record<ModuleId, DashboardModule> = {
    chat: {
      title: "Gemini Chat",
      icon: "◆",
      badge: "WEB 2.0",
      content: activeConversation ? (
        <ChatModule
          connectionStatus={connection.status}
          conversation={activeConversation}
          isBusyElsewhere={isBusy && !isBusyHere}
          isBusyHere={isBusyHere}
          model={settings.model}
          models={models}
          onModelChange={handleModelChange}
          onNewConversation={handleNewConversation}
          onOpenSettings={() => scrollToModule("connection")}
          onRetry={handleRetry}
          onSend={handleSend}
          onStop={handleStop}
          draft={drafts[activeConversation.id] ?? ""}
          onDraftChange={handleDraftChange}
        />
      ) : (
        <div className="empty-state">
          <strong>Loading your conversation…</strong>
        </div>
      ),
    },
    history: {
      title: "Conversation History",
      icon: "☰",
      badge: `${conversations.length} SAVED`,
      actions: (
        <button
          className="btn btn-small"
          onClick={handleNewConversation}
          title="Start a new conversation"
          type="button"
        >
          + New
        </button>
      ),
      content: (
        <HistoryModule
          activeId={activeConversation?.id ?? ""}
          conversations={conversations}
          onClearAll={handleClearAll}
          onDelete={handleDeleteConversation}
          onNewConversation={handleNewConversation}
          onQueryChange={setHistoryQuery}
          onSelect={handleSelectConversation}
          pendingConversationId={pendingConversationId}
          query={historyQuery}
        />
      ),
    },
    featured: {
      title: "Featured Answer",
      icon: "★",
      badge: "LATEST",
      content: (
        <FeaturedModule
          conversation={activeConversation}
          onOpenChat={() => scrollToModule("chat")}
        />
      ),
    },
    connection: {
      title: "API Settings & Connection",
      icon: "⚙",
      actions: (
        <span
          className={`titlebar-status titlebar-status--${connection.status}`}
        >
          <span className={`led led--${connection.status}`} aria-hidden="true" />
          {connection.status === "online"
            ? "online"
            : connection.status === "checking"
              ? "checking"
              : "offline"}
        </span>
      ),
      content: (
        <ConnectionModule
          connection={connection}
          models={models}
          onApplySettings={handleApplySettings}
          onModelChange={handleModelChange}
          onOpenHelp={() => scrollToModule("help")}
          settings={settings}
        />
      ),
    },
    help: {
      title: "Help & About",
      icon: "?",
      badge: "V2.0",
      content: (
        <HelpModule
          onOpenSettings={() => scrollToModule("connection")}
          settings={settings}
        />
      ),
    },
  };

  const shellProps: ThemeShellProps = {
    theme,
    onThemeChange: setTheme,
    conversations,
    activeConversation: activeConversation as Conversation,
    pendingConversationId,
    settings,
    models,
    connection,
    draft: activeConversation
      ? (drafts[activeConversation.id] ?? "")
      : "",
    onDraftChange: handleDraftChange,
    onSend: handleSend,
    onStop: handleStop,
    onRetry: handleRetry,
    onNewConversation: handleNewConversation,
    onSelectConversation: handleSelectConversation,
    onDeleteConversation: handleDeleteConversation,
    onClearAll: handleClearAll,
    onModelChange: handleModelChange,
    onApplySettings: handleApplySettings,
  };

  if (theme === "messenger") {
    return <MessengerTheme {...shellProps} />;
  }

  if (theme === "assistant") {
    return <AssistantTheme {...shellProps} />;
  }

  return (
    <div className="app">
      <Masthead
        historyQuery={historyQuery}
        onHistoryQueryChange={setHistoryQuery}
        onSearchSubmit={handleHistorySearchSubmit}
      />

      <main className="page-width main-content" id="main">
        <div className="welcome-strip">
          <div className="welcome-strip-main">
            <span aria-hidden="true" className="welcome-star">
              ✦
            </span>
            <strong>Welcome, Guest.</strong>
            <span>Your personalized Gemini dashboard is ready.</span>
          </div>
          <div className="welcome-strip-side">
            {formatLongDate()} <span className="strip-divider">·</span>{" "}
            <span className="beta-chip">BETA</span>
          </div>
        </div>

        <Dashboard
          modules={modules}
          themeControl={
            <ThemeSelect onChange={setTheme} value={theme} />
          }
        />
      </main>

      <footer className="site-footer">
        <div className="page-width footer-inner">
          <p>
            <strong>Gemini Web 2.0</strong> — an independent retro interface for
            Gemini, built around{" "}
            <a
              href="https://github.com/Sophomoresty/gemini-web2api"
              rel="noreferrer"
              target="_blank"
            >
              gemini-web2api
            </a>
            . Not affiliated with Google.
          </p>
          <p className="footer-fine">
            © 2008–2026 Gemini Labs · Your conversations stay in this browser ·{" "}
            <a href="#module-connection">
              {PROVIDER_SHORT[settings.provider]}:{" "}
              <span className={`footer-status footer-status--${connection.status}`}>
                {connection.status}
              </span>
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
