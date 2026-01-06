import { useState, useEffect, useRef, useCallback } from 'react';
import { request } from 'librechat-data-provider';

// Mock transcript content for demo
const MOCK_TRANSCRIPT = `[Percakapan dengan Customer - Hotel Booking Inquiry]

Staff: Selamat siang, ada yang bisa saya bantu?

Customer: Siang, saya mau tanya tentang reservasi hotel untuk liburan keluarga.

Staff: Baik, untuk berapa orang dan kapan rencananya?

Customer: Untuk 4 orang, 2 dewasa 2 anak. Tanggal 15-18 Januari.

Staff: Apakah ada preferensi lokasi atau tipe hotel tertentu?

Customer: Kalau bisa yang dekat pantai, dan ada kolam renang untuk anak-anak.

Staff: Untuk budget per malam kira-kira berapa?

Customer: Sekitar 1.5 sampai 2 juta per malam.

Staff: Baik, saya ada beberapa rekomendasi. Ada Grand Hyatt Bali dan Westin Resort yang sesuai kriteria.

Customer: Westin bagus, saya pernah dengar reviewnya positif. Ada promo tidak?

Staff: Kebetulan ada promo early bird 15% untuk booking minimal 3 malam.

Customer: Oke, saya tertarik. Bisa dibantu booking Westin untuk tanggal tersebut?

Staff: Tentu, saya proses sekarang. Untuk kamarnya mau tipe apa? Ada Deluxe dan Premium Suite.

Customer: Premium Suite saja, biar anak-anak lebih nyaman.

Staff: Baik, Premium Suite dengan ocean view ya. Total 3 malam sekitar 5.1 juta setelah diskon.

Customer: Oke deal. Oh iya, anak saya alergi kacang, bisa diinfokan ke hotel?

Staff: Tentu, akan saya catat untuk special request. Ada lagi yang perlu dibantu?

Customer: Cukup dulu, terima kasih banyak ya.

Staff: Sama-sama, selamat berlibur!`;

interface RecordingSectionProps {
  customerId: string;
  onTranscriptAdded: (transcript: {
    id: string;
    filename: string;
    content: string;
    createdAt: Date;
  }) => void;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export default function RecordingSection({ customerId, onTranscriptAdded }: RecordingSectionProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording timer
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState]);

  const startRecording = useCallback(() => {
    setRecordingState('recording');
    setRecordingTime(0);
  }, []);

  const stopRecording = useCallback(async () => {
    setRecordingState('processing');

    // Simulate processing delay (1.5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      // Generate filename with timestamp
      const now = new Date();
      const filename = `Transcript_${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 5).replace(':', '')}.txt`;

      // Save transcript to backend
      const transcript = await request.post(`/api/customer-profile/${customerId}/transcripts`, {
        filename,
        content: MOCK_TRANSCRIPT,
      });

      // Notify parent component
      onTranscriptAdded(transcript);

      setRecordingState('idle');
      setRecordingTime(0);
    } catch (error) {
      console.error('Error saving transcript:', error);
      setRecordingState('idle');
      setRecordingTime(0);
    }
  }, [customerId, onTranscriptAdded]);

  return (
    <div className="space-y-3">
      <h3 className="text-base font-medium text-text-primary">Record Interaction</h3>

      <div className="flex items-center gap-4">
        {recordingState === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
            >
              <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
              <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
            </svg>
            Start Recording
          </button>
        )}

        {recordingState === 'recording' && (
          <div className="flex items-center gap-4">
            {/* Recording indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex size-3 rounded-full bg-red-500"></span>
              </span>
              <span className="font-mono text-sm font-medium text-red-600">
                {formatTime(recordingTime)}
              </span>
            </div>

            {/* Stop button */}
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4"
              >
                <path
                  fillRule="evenodd"
                  d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z"
                  clipRule="evenodd"
                />
              </svg>
              Stop
            </button>
          </div>
        )}

        {recordingState === 'processing' && (
          <div className="flex items-center gap-2 text-text-secondary">
            <svg
              className="size-5 animate-spin"
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
            <span className="text-sm">Processing transcript...</span>
          </div>
        )}
      </div>
    </div>
  );
}
