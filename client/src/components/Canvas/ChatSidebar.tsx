import { useState, useRef, useEffect, useCallback } from 'react';
import { Spinner } from '@librechat/client';
import { cn } from '~/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// Types
// ============================================================================

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  birthday: string;
  status: string;
  [key: string]: unknown;
}

interface CustomerProfile {
  customerId: string;
  personalitySummary?: string;
  preferences?: string[];
  notes?: string;
  conversationId?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatSidebarProps {
  customerId: string;
  customerData: CustomerData | null;
  customerProfile: CustomerProfile | null;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onProfileUpdate?: (profile: CustomerProfile) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CRM_BACKEND_URL = 'http://localhost:8000';
const STORAGE_KEY_PREFIX = 'crm_chat_';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a system message with customer context
 */
function buildSystemMessage(
  customerData: CustomerData | null,
  customerProfile: CustomerProfile | null,
): string {
  const parts: string[] = [
    'Kamu adalah asisten CRM yang membantu tim sales memahami dan berkomunikasi dengan pelanggan.',
    'Jawablah dalam Bahasa Indonesia yang profesional namun ramah.',
    '',
  ];

  if (customerData) {
    parts.push('## Informasi Pelanggan');
    parts.push(`- Nama: ${customerData.name}`);
    parts.push(`- Email: ${customerData.email || 'Tidak tersedia'}`);
    parts.push(`- Telepon: ${customerData.phone || 'Tidak tersedia'}`);
    parts.push(`- Status: ${customerData.status || 'Tidak diketahui'}`);

    if (customerData.joinDate) {
      parts.push(`- Bergabung sejak: ${formatDate(customerData.joinDate)}`);
    }
    if (customerData.birthday) {
      parts.push(`- Ulang tahun: ${formatDate(customerData.birthday)}`);
    }

    // Add any additional fields
    const excludedKeys = ['id', 'name', 'email', 'phone', 'joinDate', 'birthday', 'status'];
    Object.entries(customerData)
      .filter(([key]) => !excludedKeys.includes(key))
      .forEach(([key, value]) => {
        if (value != null && value !== '') {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
          parts.push(
            `- ${label}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
          );
        }
      });

    parts.push('');
  }

  if (customerProfile) {
    if (customerProfile.personalitySummary) {
      parts.push('## Profil Kepribadian');
      parts.push(customerProfile.personalitySummary);
      parts.push('');
    }

    if (customerProfile.preferences && customerProfile.preferences.length > 0) {
      parts.push('## Preferensi');
      customerProfile.preferences.forEach((pref) => {
        parts.push(`- ${pref}`);
      });
      parts.push('');
    }

    if (customerProfile.notes) {
      parts.push('## Catatan');
      // Strip HTML tags for system message
      const plainNotes = customerProfile.notes
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      parts.push(plainNotes);
      parts.push('');
    }
  }

  parts.push('Gunakan informasi di atas untuk memberikan jawaban yang relevan dan personal.');
  parts.push(
    'Jika ditanya tentang data yang tidak tersedia, sampaikan dengan sopan bahwa informasi tersebut tidak ada dalam catatan.',
  );
  parts.push('');
  parts.push('### Aturan Jawaban');
  parts.push(
    '- Fokus hanya pada topik perjalanan/travel. Jangan menjawab pertanyaan di luar topik tersebut.',
  );
  parts.push(
    '- Jika pertanyaan di luar travel, memerlukan informasi terbaru dari luar data, atau konteks tidak cukup: balas persis "Saya tidak bisa menjawab pertanyaan tersebut." tanpa tambahan lain.',
  );
  parts.push(
    '- Jika bisa menjawab, gunakan hanya data yang diberikan. Sertakan satu kalimat sitasi tiruan, misalnya diawali "Berdasarkan inventory yang ada, ..." atau "Dari data transaksi yang ada, ...".',
  );
  parts.push('- Jangan mengarang fakta atau mengambil informasi di luar konteks yang disediakan.');

  return parts.join('\n');
}

/**
 * Format a date string for display
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ChatSidebar({
  customerId,
  customerData,
  customerProfile,
  isMinimized,
  onToggleMinimize,
  onProfileUpdate,
}: ChatSidebarProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------------------
  // Load saved conversation on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!customerId) return;

    // Try to load from localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}${customerId}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages)) {
          setMessages(
            parsed.messages.map((m: ChatMessage) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          );
          setConversationId(parsed.conversationId || null);
        }
      } catch (e) {
        console.error('Failed to load saved chat:', e);
      }
    }

    // Or load from customer profile if conversationId exists
    if (customerProfile?.conversationId && !conversationId) {
      setConversationId(customerProfile.conversationId);
    }
  }, [customerId, customerProfile?.conversationId]);

  // -------------------------------------------------------------------------
  // Save conversation when messages change
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!customerId || messages.length === 0) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${customerId}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        messages,
        conversationId,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, [customerId, messages, conversationId]);

  // -------------------------------------------------------------------------
  // Scroll to bottom when messages change
  // -------------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------------------------------------------------------------
  // Focus input when expanded
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isMinimized) {
      inputRef.current?.focus();
    }
  }, [isMinimized]);

  // -------------------------------------------------------------------------
  // Cleanup abort controller on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Send message handler
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Add user message
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Build messages array for API
    const systemMessage = buildSystemMessage(customerData, customerProfile);
    const apiMessages = [
      { role: 'system', content: systemMessage },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage.content },
    ];

    // Create placeholder for assistant response
    const assistantMessageId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Call CRM backend with streaming - use crm-chat-assistant for contextual chat
      const response = await fetch(`${CRM_BACKEND_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'crm-chat-assistant',
          messages: apiMessages,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      setIsLoading(false);
      setIsStreaming(true);

      // Handle SSE streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: m.content + content } : m,
                  ),
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }

      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengirim pesan');

      // Remove empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [inputValue, isLoading, isStreaming, messages, customerData, customerProfile]);

  // -------------------------------------------------------------------------
  // Stop generation handler
  // -------------------------------------------------------------------------
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  // -------------------------------------------------------------------------
  // Clear chat handler
  // -------------------------------------------------------------------------
  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);

    // Clear from localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}${customerId}`;
    localStorage.removeItem(storageKey);
  }, [customerId]);

  // -------------------------------------------------------------------------
  // Handle key press in input
  // -------------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // -------------------------------------------------------------------------
  // Render minimized state
  // -------------------------------------------------------------------------
  if (isMinimized) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-l border-border-light bg-surface-secondary">
        <button
          onClick={onToggleMinimize}
          className="flex size-12 items-center justify-center text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          title="Expand chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-5"
          >
            <path
              fillRule="evenodd"
              d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render expanded state
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full w-full flex-col border-l border-border-light bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/assets/assisstant.png"
            alt="Assistant"
            className="size-8 rounded-full object-cover"
          />
          <div>
            <h3 className="text-sm font-medium text-text-primary">Agent Assistant</h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize button */}
          <button
            onClick={onToggleMinimize}
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            title="Collapse chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-5"
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="scrollbar-hover flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-surface-tertiary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-6 text-text-tertiary"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3c-4.31 0-8 3.033-8 7 0 2.024.978 3.825 2.499 5.085a3.478 3.478 0 01-.522 1.756.75.75 0 00.584 1.143 5.976 5.976 0 003.936-1.108c.487.082.99.124 1.503.124 4.31 0 8-3.033 8-7s-3.69-7-8-7zm0 8a1 1 0 100-2 1 1 0 000 2zm-2-1a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-primary">Mulai Percakapan</p>
            <p className="mt-1 max-w-[200px] text-xs text-text-tertiary">
              Tanyakan apapun tentang pelanggan ini. AI akan menjawab berdasarkan data yang
              tersedia.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border-light p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            disabled={isLoading}
            className="flex-1 rounded-lg bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {isStreaming ? (
            <button
              onClick={stopGeneration}
              className="flex size-8 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
              title="Stop generating"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
              >
                <rect x="5" y="5" width="10" height="10" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex size-8 items-center justify-center rounded-lg bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send message"
            >
              {isLoading ? (
                <Spinner className="size-4" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4"
                >
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isEmpty = !message.content && isAssistant;

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Message content */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isUser
            ? 'bg-[#F0EFED] text-gray-900 dark:bg-gray-600 dark:text-gray-100'
            : 'bg-transparent text-gray-900 dark:text-gray-100',
        )}
      >
        {isEmpty ? (
          <span className="thinking-shimmer text-sm font-medium">Thinking...</span>
        ) : (
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-900 dark:text-gray-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
