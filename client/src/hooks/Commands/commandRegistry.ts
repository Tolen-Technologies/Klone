import { v4 } from 'uuid';
import type { TMessage, TConversation } from 'librechat-data-provider';
import { createSegment } from '~/data-provider/Segments';

const NO_PARENT = '00000000-0000-0000-0000-000000000000';

export interface CommandContext {
  getMessages: () => TMessage[] | undefined;
  setMessages: (messages: TMessage[]) => void;
  conversation: TConversation | null;
  resetForm: () => void;
}

export interface CommandDefinition {
  name: string;
  pattern: RegExp;
  description: string;
  handler: (match: RegExpMatchArray, context: CommandContext) => Promise<void>;
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    name: 'segment',
    pattern: /^\/segment\s+(.+)$/i,
    description: 'Create a customer segment',
    handler: async (match, context) => {
      const description = match[1].trim();
      const currentMessages = context.getMessages() || [];
      const conversationId = context.conversation?.conversationId || v4();
      const now = new Date().toISOString();

      const lastMessage = currentMessages[currentMessages.length - 1];
      const parentMessageId = lastMessage?.messageId || NO_PARENT;

      const userMessageId = v4();
      const userMessage: TMessage = {
        messageId: userMessageId,
        conversationId,
        parentMessageId,
        text: match[0],
        sender: 'User',
        isCreatedByUser: true,
        createdAt: now,
        updatedAt: now,
      };

      context.setMessages([...currentMessages, userMessage]);
      context.resetForm();

      const assistantMessageId = v4();
      let assistantMessage: TMessage = {
        messageId: assistantMessageId,
        conversationId,
        parentMessageId: userMessageId,
        text: 'Membuat segment...',
        sender: 'CRM Assistant',
        isCreatedByUser: false,
        createdAt: now,
        updatedAt: now,
      };

      context.setMessages([...currentMessages, userMessage, assistantMessage]);

      try {
        const segment = await createSegment({ description });
        const segmentUrl = `/segments?selected=${segment.segmentId}`;
        assistantMessage = {
          ...assistantMessage,
          text: `Segment berhasil dibuat!\n\n**${segment.name}**\n\n${segment.description || ''}\n\n[Lihat Segment](${segmentUrl})`,
          updatedAt: new Date().toISOString(),
        };
        context.setMessages([...currentMessages, userMessage, assistantMessage]);
      } catch (error) {
        console.error('[/segment] Error creating segment:', error);
        assistantMessage = {
          ...assistantMessage,
          text: 'Gagal membuat segment. Silakan coba lagi.',
          error: true,
          updatedAt: new Date().toISOString(),
        };
        context.setMessages([...currentMessages, userMessage, assistantMessage]);
      }
    },
  },
];

/** Get command names for validation */
export const VALID_COMMAND_NAMES = COMMAND_DEFINITIONS.map((cmd) => cmd.name);

/** Check if text matches any command */
export function matchCommand(
  text: string,
): { command: CommandDefinition; match: RegExpMatchArray } | null {
  for (const command of COMMAND_DEFINITIONS) {
    const match = text.match(command.pattern);
    if (match) {
      return { command, match };
    }
  }
  return null;
}

/** Check if a partial command name is valid (for highlighting) */
export function isValidCommandPrefix(commandName: string): 'valid' | 'partial' | 'invalid' {
  const lowerName = commandName.toLowerCase();

  // Exact match
  if (VALID_COMMAND_NAMES.includes(lowerName)) {
    return 'valid';
  }

  // Partial match (typing in progress)
  if (VALID_COMMAND_NAMES.some((name) => name.startsWith(lowerName))) {
    return 'partial';
  }

  return 'invalid';
}

/** Parse command from text for highlighting purposes */
export function parseCommandFromText(text: string): {
  isCommand: boolean;
  commandPart: string;
  argsPart: string;
  status: 'valid' | 'partial' | 'invalid';
} | null {
  if (!text.startsWith('/')) {
    return null;
  }

  // Find the first space (separates command from args)
  const spaceIndex = text.indexOf(' ');

  if (spaceIndex === -1) {
    // No space yet, entire text after / is the command
    const commandPart = text.slice(1); // Remove leading /
    return {
      isCommand: true,
      commandPart: text, // Include the /
      argsPart: '',
      status: isValidCommandPrefix(commandPart),
    };
  }

  // Has space, split into command and args
  const commandPart = text.slice(1, spaceIndex); // Command without /
  const argsPart = text.slice(spaceIndex);

  return {
    isCommand: true,
    commandPart: text.slice(0, spaceIndex), // Include the /
    argsPart,
    status: isValidCommandPrefix(commandPart),
  };
}

/** Create a segment from a description (without /segment prefix) */
export async function createSegmentFromDescription(
  description: string,
  context: CommandContext,
): Promise<void> {
  const segmentCommand = COMMAND_DEFINITIONS.find((cmd) => cmd.name === 'segment');
  if (!segmentCommand) {
    console.error('[createSegmentFromDescription] Segment command not found');
    return;
  }

  // Create a fake match that looks like it came from /segment <description>
  const fakeMatch = [`/segment ${description}`, description] as RegExpMatchArray;
  fakeMatch.index = 0;
  fakeMatch.input = `/segment ${description}`;

  await segmentCommand.handler(fakeMatch, context);
}
