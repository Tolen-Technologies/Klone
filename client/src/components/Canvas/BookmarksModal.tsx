import { useState } from 'react';
import { request } from 'librechat-data-provider';

interface BookmarkedFact {
  id: string;
  text: string;
  transcriptId?: string;
  createdAt: Date | string;
}

interface BookmarksModalProps {
  bookmarks: BookmarkedFact[];
  customerId: string;
  onClose: () => void;
  onBookmarkRemoved: (factId: string) => void;
  onAcceptBookmark: (text: string) => void;
}

export default function BookmarksModal({
  bookmarks,
  customerId,
  onClose,
  onBookmarkRemoved,
  onAcceptBookmark,
}: BookmarksModalProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleRemove = async (factId: string) => {
    setRemovingId(factId);
    try {
      await request.delete(`/api/customer-profile/${customerId}/bookmarks/${factId}`);
      onBookmarkRemoved(factId);
    } catch (error) {
      console.error('Error removing bookmark:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleAccept = (bookmark: BookmarkedFact) => {
    onAcceptBookmark(bookmark.text);
    handleRemove(bookmark.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5 text-yellow-500"
            >
              <path
                fillRule="evenodd"
                d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="text-lg font-semibold text-text-primary">Bookmarked Facts</h3>
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
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-12 text-text-tertiary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                />
              </svg>
              <p className="mt-4 text-sm text-text-secondary">No bookmarked facts yet</p>
              <p className="mt-1 text-xs text-text-tertiary">
                Bookmark facts from transcripts to review them later
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-start gap-3 rounded-lg border border-border-light bg-surface-secondary p-3"
                >
                  {/* Bookmark icon */}
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="size-3.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{bookmark.text}</p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      {formatDate(bookmark.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 gap-1">
                    {/* Accept (add to notes) */}
                    <button
                      onClick={() => handleAccept(bookmark)}
                      disabled={removingId === bookmark.id}
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-green-100 hover:text-green-600 disabled:opacity-50 dark:hover:bg-green-900 dark:hover:text-green-400"
                      title="Add to notes"
                    >
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
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(bookmark.id)}
                      disabled={removingId === bookmark.id}
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900 dark:hover:text-red-400"
                      title="Remove bookmark"
                    >
                      {removingId === bookmark.id ? (
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
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border-light px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
