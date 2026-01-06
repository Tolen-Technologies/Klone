import { useState, useEffect } from 'react';
import { request } from 'librechat-data-provider';

// Mock facts that would be extracted from the transcript
const MOCK_FACTS = [
  {
    id: '1',
    text: 'Merencanakan liburan keluarga (4 orang: 2 dewasa, 2 anak) tanggal 15-18 Januari',
  },
  {
    id: '2',
    text: 'Preferensi hotel dekat pantai dengan kolam renang untuk anak-anak',
  },
  {
    id: '3',
    text: 'Budget hotel sekitar 1.5-2 juta per malam',
  },
  {
    id: '4',
    text: 'Tertarik dengan Westin Resort, sudah mendengar review positif',
  },
  {
    id: '5',
    text: 'Booking Premium Suite dengan ocean view di Westin',
  },
  {
    id: '6',
    text: 'Anak memiliki alergi kacang - perlu special request ke hotel',
  },
];

interface Transcript {
  id: string;
  filename: string;
  content: string;
  createdAt: Date | string;
}

interface FactsProcessingModalProps {
  transcript: Transcript;
  customerId: string;
  onClose: () => void;
  onFactsProcessed: (acceptedFacts: string[]) => void;
  onBookmarkAdded: (bookmark: {
    id: string;
    text: string;
    transcriptId?: string;
    createdAt: Date;
  }) => void;
}

type FactStatus = 'pending' | 'accepted' | 'discarded' | 'bookmarked';

interface Fact {
  id: string;
  text: string;
  status: FactStatus;
}

export default function FactsProcessingModal({
  transcript,
  customerId,
  onClose,
  onFactsProcessed,
  onBookmarkAdded,
}: FactsProcessingModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Simulate loading facts (mock LLM processing)
  useEffect(() => {
    const loadFacts = async () => {
      // Simulate 2 second processing time
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setFacts(
        MOCK_FACTS.map((f) => ({
          ...f,
          status: 'pending' as FactStatus,
        })),
      );
      setIsLoading(false);
    };

    loadFacts();
  }, []);

  const handleAccept = (factId: string) => {
    setFacts((prev) =>
      prev.map((f) => (f.id === factId ? { ...f, status: 'accepted' as FactStatus } : f)),
    );
  };

  const handleDiscard = (factId: string) => {
    setFacts((prev) =>
      prev.map((f) => (f.id === factId ? { ...f, status: 'discarded' as FactStatus } : f)),
    );
  };

  const handleBookmark = async (factId: string) => {
    const fact = facts.find((f) => f.id === factId);
    if (!fact) return;

    try {
      // Save bookmark to backend
      const bookmark = await request.post(`/api/customer-profile/${customerId}/bookmarks`, {
        text: fact.text,
        transcriptId: transcript.id,
      });

      setFacts((prev) =>
        prev.map((f) => (f.id === factId ? { ...f, status: 'bookmarked' as FactStatus } : f)),
      );

      onBookmarkAdded(bookmark);
    } catch (error) {
      console.error('Error saving bookmark:', error);
    }
  };

  const handleSave = async () => {
    const acceptedFacts = facts.filter((f) => f.status === 'accepted').map((f) => f.text);

    if (acceptedFacts.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);

    try {
      // Notify parent to append to notes
      onFactsProcessed(acceptedFacts);
      onClose();
    } catch (error) {
      console.error('Error saving facts:', error);
      setIsSaving(false);
    }
  };

  const pendingCount = facts.filter((f) => f.status === 'pending').length;
  const acceptedCount = facts.filter((f) => f.status === 'accepted').length;

  const getStatusIcon = (status: FactStatus) => {
    switch (status) {
      case 'accepted':
        return (
          <div className="flex size-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case 'discarded':
        return (
          <div className="flex size-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </div>
        );
      case 'bookmarked':
        return (
          <div className="flex size-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4"
            >
              <path
                fillRule="evenodd"
                d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[85vh] w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Process Transcript</h3>
            <p className="text-xs text-text-tertiary">{transcript.filename}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[55vh] overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg
                className="size-8 animate-spin text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="mt-4 text-sm text-text-secondary">
                Extracting facts from transcript...
              </p>
              <p className="mt-1 text-xs text-text-tertiary">AI is analyzing the conversation</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Review the extracted facts. Accept to add to notes, bookmark for later, or discard.
              </p>

              <div className="space-y-2">
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      fact.status === 'discarded'
                        ? 'border-gray-200 bg-gray-50 opacity-50 dark:border-gray-700 dark:bg-gray-800'
                        : fact.status === 'accepted'
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                          : fact.status === 'bookmarked'
                            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                            : 'border-border-light bg-surface-secondary'
                    }`}
                  >
                    {/* Status indicator */}
                    <div className="shrink-0 pt-0.5">{getStatusIcon(fact.status)}</div>

                    {/* Fact text */}
                    <p
                      className={`flex-1 text-sm ${
                        fact.status === 'discarded'
                          ? 'text-text-tertiary line-through'
                          : 'text-text-primary'
                      }`}
                    >
                      {fact.text}
                    </p>

                    {/* Action buttons */}
                    {fact.status === 'pending' && (
                      <div className="flex shrink-0 gap-1">
                        {/* Accept */}
                        <button
                          onClick={() => handleAccept(fact.id)}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900 dark:hover:text-green-400"
                          title="Accept"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>

                        {/* Discard */}
                        <button
                          onClick={() => handleDiscard(fact.id)}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 dark:hover:text-red-400"
                          title="Discard"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-5"
                          >
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                          </svg>
                        </button>

                        {/* Bookmark */}
                        <button
                          onClick={() => handleBookmark(fact.id)}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-yellow-100 hover:text-yellow-600 dark:hover:bg-yellow-900 dark:hover:text-yellow-400"
                          title="Bookmark for later"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="size-5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="flex items-center justify-between border-t border-border-light px-6 py-4">
            <div className="text-sm text-text-tertiary">
              {pendingCount > 0 ? (
                <span>{pendingCount} remaining</span>
              ) : (
                <span>{acceptedCount} facts to add</span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || pendingCount > 0}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="size-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>Save to Notes</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
