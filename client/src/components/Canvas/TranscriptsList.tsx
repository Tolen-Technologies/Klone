import { useState } from 'react';

interface Transcript {
  id: string;
  filename: string;
  content: string;
  createdAt: Date | string;
}

interface TranscriptsListProps {
  transcripts: Transcript[];
  onProcessTranscript: (transcript: Transcript) => void;
}

export default function TranscriptsList({
  transcripts,
  onProcessTranscript,
}: TranscriptsListProps) {
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);

  if (transcripts.length === 0) {
    return null;
  }

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-medium text-text-primary">Transcripts</h3>

      {/* Horizontal scrollable list */}
      <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
        {transcripts.map((transcript) => (
          <div
            key={transcript.id}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 transition-colors hover:bg-surface-tertiary"
          >
            {/* File icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5 shrink-0 text-blue-500"
            >
              <path
                fillRule="evenodd"
                d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z"
                clipRule="evenodd"
              />
              <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
            </svg>

            {/* Filename */}
            <span className="max-w-32 truncate text-sm text-text-primary">
              {transcript.filename}
            </span>

            {/* View button */}
            <button
              onClick={() => setSelectedTranscript(transcript)}
              className="rounded p-1 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
              title="View transcript"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
              >
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                <path
                  fillRule="evenodd"
                  d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Process button */}
            <button
              onClick={() => onProcessTranscript(transcript)}
              className="rounded p-1 text-text-tertiary transition-colors hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900 dark:hover:text-blue-400"
              title="Process transcript"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Transcript viewer modal */}
      {selectedTranscript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {selectedTranscript.filename}
                </h3>
                <p className="text-xs text-text-tertiary">
                  {formatDate(selectedTranscript.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedTranscript(null)}
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
            <div className="max-h-[60vh] overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-secondary">
                {selectedTranscript.content}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-border-light px-6 py-4">
              <button
                onClick={() => setSelectedTranscript(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onProcessTranscript(selectedTranscript);
                  setSelectedTranscript(null);
                }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                    clipRule="evenodd"
                  />
                </svg>
                Process Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
