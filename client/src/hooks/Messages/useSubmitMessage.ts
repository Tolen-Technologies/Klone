import { v4 } from 'uuid';
import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Constants, replaceSpecialVars } from 'librechat-data-provider';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import { CRM_SEGMENT_TOOL_KEY } from '~/Providers/BadgeRowContext';
import { useAuthContext } from '~/hooks/AuthContext';
import { matchCommand, createSegmentFromDescription } from '~/hooks/Commands';
import store from '~/store';
import { ephemeralAgentByConvoId } from '~/store';

const appendIndex = (index: number, value?: string) => {
  if (!value) {
    return value;
  }
  return `${value}${Constants.COMMON_DIVIDER}${index}`;
};

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { ask, index, getMessages, setMessages, latestMessage, conversation } = useChatContext();
  const { addedIndex, ask: askAdditional, conversation: addedConvo } = useAddedChatContext();

  const autoSendPrompts = useRecoilValue(store.autoSendPrompts);
  const activeConvos = useRecoilValue(store.allConversationsSelector);
  const setActivePrompt = useSetRecoilState(store.activePromptByIndex(index));

  // Check if CRM Segment tool is enabled
  const convoKey = conversation?.conversationId ?? Constants.NEW_CONVO;
  const ephemeralAgent = useRecoilValue(ephemeralAgentByConvoId(convoKey));
  const isCrmSegmentEnabled = ephemeralAgent?.[CRM_SEGMENT_TOOL_KEY] === true;

  const submitMessage = useCallback(
    async (data?: { text: string }) => {
      if (!data) {
        return console.warn('No data provided to submitMessage');
      }

      // Check if text matches any registered command
      const commandMatch = matchCommand(data.text);
      if (commandMatch) {
        const { command, match } = commandMatch;
        await command.handler(match, {
          getMessages,
          setMessages,
          conversation,
          resetForm: () => methods.reset(),
        });
        return; // Don't send to LLM
      }

      // Check if CRM Segment tool is enabled - treat input as segment description
      if (isCrmSegmentEnabled && data.text.trim()) {
        await createSegmentFromDescription(data.text.trim(), {
          getMessages,
          setMessages,
          conversation,
          resetForm: () => methods.reset(),
        });
        return; // Don't send to LLM
      }

      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      const hasAdded = addedIndex && activeConvos[addedIndex] && addedConvo;
      const isNewMultiConvo =
        hasAdded &&
        activeConvos.every((convoId) => convoId === Constants.NEW_CONVO) &&
        !rootMessages?.length;
      const overrideConvoId = isNewMultiConvo ? v4() : undefined;
      const overrideUserMessageId = hasAdded ? v4() : undefined;
      const rootIndex = addedIndex - 1;
      const clientTimestamp = new Date().toISOString();

      ask({
        text: data.text,
        overrideConvoId: appendIndex(rootIndex, overrideConvoId),
        overrideUserMessageId: appendIndex(rootIndex, overrideUserMessageId),
        clientTimestamp,
      });

      if (hasAdded) {
        askAdditional(
          {
            text: data.text,
            overrideConvoId: appendIndex(addedIndex, overrideConvoId),
            overrideUserMessageId: appendIndex(addedIndex, overrideUserMessageId),
            clientTimestamp,
          },
          { overrideMessages: rootMessages },
        );
      }
      methods.reset();
    },
    [
      ask,
      methods,
      addedIndex,
      addedConvo,
      setMessages,
      getMessages,
      activeConvos,
      askAdditional,
      latestMessage,
      conversation,
      isCrmSegmentEnabled,
    ],
  );

  const submitPrompt = useCallback(
    (text: string) => {
      const parsedText = replaceSpecialVars({ text, user });
      if (autoSendPrompts) {
        submitMessage({ text: parsedText });
        return;
      }

      const currentText = methods.getValues('text');
      const newText = currentText.trim().length > 1 ? `\n${parsedText}` : parsedText;
      setActivePrompt(newText);
    },
    [autoSendPrompts, submitMessage, setActivePrompt, methods, user],
  );

  return { submitMessage, submitPrompt };
}
