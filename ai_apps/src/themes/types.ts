import type {
  AppTheme,
  ConnectionState,
  Conversation,
  GeminiSettings,
  ModelInfo,
} from "../types";

/**
 * Shared application state handed to a skin. Both alternate themes read the
 * same conversations/settings and call the same handlers as the Web 2.0 shell;
 * they never call the Gemini API themselves.
 */
export interface ThemeShellProps {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  conversations: Conversation[];
  activeConversation: Conversation;
  pendingConversationId: string | null;
  settings: GeminiSettings;
  models: ModelInfo[];
  connection: ConnectionState;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (content: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
  onModelChange: (model: string) => void;
  onApplySettings: (settings: GeminiSettings) => void;
}
