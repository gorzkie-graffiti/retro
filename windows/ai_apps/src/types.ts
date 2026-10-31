export type ChatRole = "user" | "assistant";

export type AppTheme = "web20" | "messenger" | "assistant";

export interface MessageMeta {
  model?: string;
  durationMs?: number;
  error?: string;
  cancelled?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  meta?: MessageMeta;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/** Where answers come from: the local bridge or Google's Gemini API. */
export type GeminiProvider = "bridge" | "ai-studio";

export interface GeminiSettings {
  provider: GeminiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ModelInfo {
  id: string;
  description: string;
}

export type ConnectionStatus = "checking" | "online" | "offline";

export interface ConnectionState {
  status: ConnectionStatus;
  message: string;
  checkedAt: number | null;
  latencyMs?: number;
  modelCount?: number;
}

