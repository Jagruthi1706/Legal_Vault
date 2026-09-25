import React, { createContext, useCallback, useContext, useState } from 'react';
import { AIMessage, MessageAttachment } from '../types';
import { aiApi, AIOperation, AIResponse } from '../services/aiApi';
import { mapAIResponseToMessage } from '../utils/aiCopilot';

export interface CaseAIContext {
  caseId: string;
  caseNumber?: string;
  title?: string;
}

interface CopilotContextType {
  isOpen: boolean;
  toggleOpen: () => void;
  setIsOpen: (open: boolean) => void;
  messages: AIMessage[];
  sendMessage: (text: string, operation?: AIOperation, attachments?: File[]) => void;
  isThinking: boolean;
  lastError: string | null;
  clearChat: () => void;
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  activeContextCaseId?: string;
  activeCaseContext?: CaseAIContext;
  setActiveContextCaseId: (caseId?: string) => void;
  setActiveCaseContext: (context?: CaseAIContext) => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

const requestByOperation = (caseId: string, text: string, operation: AIOperation): Promise<AIResponse> => {
  if (operation === 'summarize') return aiApi.summarize(caseId);
  if (operation === 'analyze_evidence') return aiApi.analyzeEvidence(caseId, text);
  if (operation === 'research') return aiApi.research(caseId, text);
  if (operation === 'compare_authorities') return aiApi.compareAuthorities(caseId, text);
  return aiApi.chat(caseId, text, operation);
};

export const CopilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(380);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [activeCaseContext, setActiveCaseContextState] = useState<CaseAIContext>();

  const setActiveCaseContext = useCallback((context?: CaseAIContext) => {
    setActiveCaseContextState((current) => {
      if (current?.caseId !== context?.caseId) {
        setMessages([]);
        setLastError(null);
      }
      return context;
    });
  }, []);

  const setActiveContextCaseId = useCallback((caseId?: string) => {
    setActiveCaseContext(caseId ? { caseId } : undefined);
  }, [setActiveCaseContext]);

  const sendMessage = useCallback((text: string, operation: AIOperation = 'answer', attachments: File[] = []) => {
    const caseId = activeCaseContext?.caseId;
    if (!text.trim()) return;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Keep the actual selected files on the user message (in-memory only) so the
    // attachment stays visible and previewable in the chat history after sending.
    const messageAttachments: MessageAttachment[] | undefined =
      attachments.length > 0
        ? attachments.map((file) => ({
            name: file.name,
            size: file.size,
            mimeType: file.type,
            file,
          }))
        : undefined;

    if (!caseId) {
      setMessages((items) => [
        ...items,
        { id: `user-${Date.now()}`, sender: 'user', text, timestamp, attachments: messageAttachments },
      ]);

      // No case selected: the backend decides — uploaded attachments, the trusted
      // legal knowledge base for general legal questions, or a clear unavailable
      // message. Arbitrary case documents are never retrieved on this path.
      setIsThinking(true);
      setLastError(null);
      void aiApi
        .chatNoCase(text, attachments, operation)
        .then((result) => {
          setMessages((items) => [...items, mapAIResponseToMessage(result, timestamp)]);
        })
        .catch((error: Error) => {
          const message = error.message || 'AI request failed.';
          setLastError(message);
          setMessages((items) => [
            ...items,
            { id: `error-${Date.now()}`, sender: 'assistant', text: `AI request failed: ${message}`, timestamp, providerMode: 'MOCK', status: 'unavailable' },
          ]);
        })
        .finally(() => setIsThinking(false));
      return;
    }

    setLastError(null);
    setMessages((items) => [
      ...items,
      { id: `user-${Date.now()}`, sender: 'user', text, timestamp, attachments: messageAttachments },
    ]);
    setIsThinking(true);

    const apiCall = attachments.length > 0
      ? aiApi.chatWithAttachments(caseId, text, attachments, operation)
      : requestByOperation(caseId, text, operation);

    void apiCall
      .then((result) => {
        setMessages((items) => [...items, mapAIResponseToMessage(result, timestamp)]);
      })
      .catch((error: Error) => {
        const message = error.message || 'AI request failed.';
        setLastError(message);
        setMessages((items) => [
          ...items,
          { id: `error-${Date.now()}`, sender: 'assistant', text: `AI request failed: ${message}`, timestamp, providerMode: 'MOCK', status: 'unavailable' },
        ]);
      })
      .finally(() => setIsThinking(false));
  }, [activeCaseContext?.caseId]);

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        toggleOpen: () => setIsOpen((value) => !value),
        setIsOpen,
        messages,
        sendMessage,
        isThinking,
        lastError,
        clearChat: () => {
          setMessages([]);
          setLastError(null);
        },
        panelWidth,
        setPanelWidth,
        activeContextCaseId: activeCaseContext?.caseId,
        activeCaseContext,
        setActiveContextCaseId,
        setActiveCaseContext,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
};

export const useCopilot = () => {
  const context = useContext(CopilotContext);
  if (!context) throw new Error('useCopilot must be used within a CopilotProvider');
  return context;
};
