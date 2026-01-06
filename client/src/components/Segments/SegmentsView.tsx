import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  OGDialog,
  OGDialogContent,
  Spinner,
  TooltipAnchor,
  SelectDropDown,
} from '@librechat/client';
import type { Option } from '@librechat/client';
import {
  useSegmentsQuery,
  useExecuteSegmentMutation,
  useRefreshSegmentMutation,
} from '~/data-provider/Segments';
import type { SegmentExecuteResult } from '~/data-provider/Segments';
import DataTable from './DataTable';

const LAST_VISITED_SEGMENT_KEY = 'lastVisitedSegmentId';

export default function SegmentsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [executeResult, setExecuteResult] = useState<SegmentExecuteResult | null>(null);

  // Fetch all segments
  const { data: segments = [], isLoading: isLoadingSegments } = useSegmentsQuery();

  // Execute segment mutation
  const { mutate: executeSegment, isLoading: isExecuting } = useExecuteSegmentMutation(
    selectedSegmentId,
    {
      onSuccess: (data) => {
        setExecuteResult(data);
      },
    },
  );

  // Refresh segment mutation
  const { mutate: refreshSegment, isLoading: isRefreshPending } = useRefreshSegmentMutation(
    selectedSegmentId,
    {
      onSuccess: (data) => {
        setExecuteResult(data.data);
        setShowRefreshDialog(false);
      },
      onError: (error) => {
        console.error('Refresh failed:', error);
        setShowRefreshDialog(false);
      },
    },
  );

  // Return all segments (filtering removed)
  const filteredSegments = useMemo(() => segments, [segments]);

  // Find selected segment
  const selectedSegment = useMemo(
    () => segments.find((seg) => seg.segmentId === selectedSegmentId),
    [segments, selectedSegmentId],
  );

  // Create options for SelectDropDown
  const segmentOptions: Option[] = useMemo(() => {
    return filteredSegments.map((segment) => ({
      label: `${segment.name} (${segment.lastRowCount ?? 0} customers)`,
      value: segment.segmentId,
    }));
  }, [filteredSegments]);

  // Get selected option for SelectDropDown
  const selectedOption = useMemo(() => {
    if (!selectedSegmentId) {
      return null;
    }
    return segmentOptions.find((opt) => opt.value === selectedSegmentId) ?? null;
  }, [selectedSegmentId, segmentOptions]);

  // Auto-execute when segment is selected
  useEffect(() => {
    if (selectedSegmentId) {
      executeSegment();
    }
  }, [selectedSegmentId, executeSegment]);

  // Read from URL params on mount
  useEffect(() => {
    const selectedParam = searchParams.get('selected');
    if (selectedParam && segments.length > 0) {
      const exists = segments.find((s) => s.segmentId === selectedParam);
      if (exists) {
        setSelectedSegmentId(selectedParam);
        localStorage.setItem(LAST_VISITED_SEGMENT_KEY, selectedParam);
      }
    }
  }, [searchParams, segments]);

  // Select first segment by default if no URL param
  useEffect(() => {
    const selectedParam = searchParams.get('selected');
    if (segments.length > 0 && !selectedSegmentId && !selectedParam) {
      const firstSegmentId = segments[0].segmentId;
      setSelectedSegmentId(firstSegmentId);
      localStorage.setItem(LAST_VISITED_SEGMENT_KEY, firstSegmentId);
    }
  }, [segments, selectedSegmentId, searchParams]);

  // Handler for segment selection change
  const handleSegmentChange = (option: Option | string) => {
    const segmentId = typeof option === 'string' ? option : ((option?.value as string) ?? '');
    setSelectedSegmentId(segmentId);
    if (segmentId) {
      setSearchParams({ selected: segmentId });
      // Store in localStorage for navigation back from Canvas
      localStorage.setItem(LAST_VISITED_SEGMENT_KEY, segmentId);
    } else {
      setSearchParams({});
    }
  };

  // Handler for refresh button click
  const handleRefreshClick = () => {
    setShowRefreshDialog(true);
  };

  // Handler for confirming refresh
  const confirmRefresh = () => {
    refreshSegment();
  };

  return (
    <div className="flex h-screen w-full flex-col bg-surface-primary">
      {/* Header */}
      <div className="border-b border-border-light bg-surface-secondary p-4">
        <h1 className="text-2xl font-semibold text-text-primary">Customer Segments</h1>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {/* Controls Row */}
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Segment Dropdown and Refresh Button */}
          <div className="flex items-end gap-2 md:w-1/2">
            <div className="flex flex-1 flex-col gap-2">
              {isLoadingSegments ? (
                <div className="flex h-10 items-center rounded-lg border border-border-light bg-surface-primary px-3">
                  <Spinner className="size-4" />
                  <span className="ml-2 text-sm text-text-tertiary">Loading segments...</span>
                </div>
              ) : (
                <SelectDropDown
                  value={selectedOption}
                  setValue={handleSegmentChange}
                  availableValues={segmentOptions}
                  placeholder="Select a segment..."
                  showLabel={true}
                  containerClassName="w-full"
                  className="rounded-lg"
                />
              )}
            </div>
            {selectedSegment && (
              <Button
                variant="outline"
                onClick={handleRefreshClick}
                disabled={isRefreshPending || isExecuting}
                className="h-10 whitespace-nowrap"
              >
                {isRefreshPending ? 'Memperbarui...' : 'Perbarui Data'}
              </Button>
            )}
          </div>

          {/* Stats with Info Tooltip */}
          {selectedSegment && (
            <div className="flex items-center gap-3 md:w-1/2 md:justify-end">
              <TooltipAnchor
                description={`Description: ${selectedSegment.description || 'N/A'}\n\nOriginal Prompt: ${selectedSegment.originalPrompt || 'N/A'}`}
                side="bottom"
                className="cursor-help"
              >
                <div className="flex size-8 items-center justify-center rounded-full border border-border-light bg-surface-secondary text-text-tertiary transition-colors hover:bg-surface-tertiary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </TooltipAnchor>
              <div className="gap-1 text-right text-sm text-text-tertiary">
                {selectedSegment.lastExecutedAt
                  ? new Date(selectedSegment.lastExecutedAt).toLocaleString('id-ID')
                  : 'Never'}
              </div>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-hidden">
          {isExecuting ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="size-8" />
                <p className="text-sm text-text-tertiary">Executing segment query...</p>
              </div>
            </div>
          ) : !selectedSegmentId ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-text-tertiary">Select a segment to view customer data</p>
            </div>
          ) : executeResult ? (
            <DataTable columns={executeResult.columns} data={executeResult.rows} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-text-tertiary">No data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Refresh Confirmation Dialog */}
      <OGDialog open={showRefreshDialog} onOpenChange={setShowRefreshDialog}>
        <OGDialogContent>
          <div className="p-4">
            <h3 className="mb-2 text-lg font-semibold text-text-primary">Perbarui Segment?</h3>
            <p className="mb-4 text-sm text-text-secondary">
              Data segment akan diperbarui dengan tanggal hari ini. Proses ini akan mengubah
              kriteria waktu (misalnya &quot;6 bulan terakhir&quot;) berdasarkan tanggal saat ini.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRefreshDialog(false)}>
                Batal
              </Button>
              <Button onClick={confirmRefresh} disabled={isRefreshPending}>
                {isRefreshPending ? 'Memperbarui...' : 'Ya, Perbarui'}
              </Button>
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
