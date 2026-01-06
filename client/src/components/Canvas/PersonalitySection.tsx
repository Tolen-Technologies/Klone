import { useState, useEffect, useCallback, useRef } from 'react';
import { Spinner } from '@librechat/client';
import { request } from 'librechat-data-provider';

interface CustomerPersonality {
  summary: string;
  preferences: string;
  generatedAt?: Date | string;
}

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

interface PersonalitySectionProps {
  customerId: string;
  customerData: CustomerData | null;
  initialPersonality?: CustomerPersonality | null;
  profileLoaded?: boolean;
  onPersonalityUpdate?: (personality: CustomerPersonality) => void;
}

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

export default function PersonalitySection({
  customerId,
  customerData,
  initialPersonality,
  profileLoaded = false,
  onPersonalityUpdate,
}: PersonalitySectionProps) {
  const [personality, setPersonality] = useState<CustomerPersonality | null>(
    initialPersonality || null,
  );
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Track if we've already triggered auto-generation
  const hasTriggeredGeneration = useRef(false);

  // Check if personality exists and has content
  const hasValidPersonality = useCallback((p: CustomerPersonality | null | undefined): boolean => {
    if (!p) return false;
    return Boolean(p.summary?.trim() || p.preferences?.trim());
  }, []);

  // Generate personality from CRM backend
  const generatePersonality = useCallback(async () => {
    if (!customerId || !customerData) {
      setError('Customer data is required to generate personality');
      return;
    }

    setStatus('generating');
    setError(null);

    try {
      // Step 1: Call CRM backend to generate personality
      const crmResponse = await fetch(
        `http://localhost:8000/api/customer/${customerId}/personality`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            custid: parseInt(customerId, 10),
            custname: customerData.name,
            custemail: customerData.email,
            mobileno: customerData.phone,
            birthday: customerData.birthday,
            joindate: customerData.joinDate,
            status: customerData.status,
            // Include any additional fields from customer data
            ...Object.fromEntries(
              Object.entries(customerData).filter(
                ([key]) =>
                  !['id', 'name', 'email', 'phone', 'joinDate', 'birthday', 'status'].includes(key),
              ),
            ),
          }),
        },
      );

      if (!crmResponse.ok) {
        const errorData = await crmResponse.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to generate personality: ${crmResponse.statusText}`,
        );
      }

      const generatedPersonality = await crmResponse.json();

      // Step 2: Save the generated personality to LibreChat profile
      let savedProfile: { personality?: CustomerPersonality } | null = null;
      try {
        savedProfile = (await request.put(`/api/customer-profile/${customerId}/personality`, {
          summary: generatedPersonality.summary,
          preferences: generatedPersonality.preferences,
        })) as { personality?: CustomerPersonality } | null;
      } catch (saveError) {
        // If save fails, still show the generated personality but warn user
        console.error('Failed to save personality to profile:', saveError);
      }

      // Update local state with the generated personality
      const newPersonality: CustomerPersonality = {
        summary: generatedPersonality.summary,
        preferences: generatedPersonality.preferences,
        generatedAt: savedProfile?.personality?.generatedAt || new Date().toISOString(),
      };

      setPersonality(newPersonality);
      setStatus('success');

      // Notify parent component
      if (onPersonalityUpdate) {
        onPersonalityUpdate(newPersonality);
      }
    } catch (err) {
      console.error('Error generating personality:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate personality');
      setStatus('error');
    }
  }, [customerId, customerData, onPersonalityUpdate]);

  // Auto-generate personality on first visit if not exists
  useEffect(() => {
    // Only trigger once
    if (hasTriggeredGeneration.current) {
      return;
    }

    // Wait for profile fetch and customer data
    if (!profileLoaded || !customerData) {
      return;
    }

    // Check if personality already exists
    if (hasValidPersonality(initialPersonality)) {
      setPersonality(initialPersonality!);
      return;
    }

    // Generate personality automatically
    hasTriggeredGeneration.current = true;
    generatePersonality();
  }, [customerData, initialPersonality, profileLoaded, hasValidPersonality, generatePersonality]);

  // Update personality when initialPersonality prop changes
  useEffect(() => {
    if (hasValidPersonality(initialPersonality) && !hasTriggeredGeneration.current) {
      setPersonality(initialPersonality!);
    }
  }, [initialPersonality, hasValidPersonality]);

  // Format date for display
  const formatGeneratedDate = (dateValue: Date | string | undefined): string => {
    if (!dateValue) return '';
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Handle regenerate confirmation
  const handleRegenerateClick = () => {
    if (hasValidPersonality(personality)) {
      setShowRegenerateConfirm(true);
    } else {
      generatePersonality();
    }
  };

  const handleConfirmRegenerate = () => {
    setShowRegenerateConfirm(false);
    generatePersonality();
  };

  const handleCancelRegenerate = () => {
    setShowRegenerateConfirm(false);
  };

  // Parse preferences into badges (split by comma or newline)
  const parsePreferencesIntoBadges = (preferences: string): string[] => {
    if (!preferences) return [];
    return preferences
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p.length < 50); // Filter out empty and very long items
  };

  // Render loading state
  if (status === 'generating') {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-medium text-text-primary">
          Relationship Understanding (Draft)
        </h2>
        <div className="flex flex-col items-center justify-center py-6">
          <Spinner className="size-6" />
          <p className="mt-3 text-sm text-text-secondary">Generating personality...</p>
          <p className="mt-1 text-xs text-text-tertiary">AI is analyzing customer data</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-medium text-text-primary">
          Relationship Understanding (Draft)
        </h2>
        <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-5 shrink-0 text-red-600 dark:text-red-400"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to generate</p>
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={generatePersonality}
            className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render personality content
  if (hasValidPersonality(personality)) {
    const preferenceBadges = parsePreferencesIntoBadges(personality!.preferences);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-text-primary">
            Relationship Understanding (Draft)
          </h2>
          <button
            onClick={handleRegenerateClick}
            className="flex items-center gap-1 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
            title="Regenerate personality"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-3.5"
            >
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                clipRule="evenodd"
              />
            </svg>
            Regenerate
          </button>
        </div>

        {/* Regenerate Confirmation */}
        {showRegenerateConfirm && (
          <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
              Regenerate personality? This will replace the current analysis.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmRegenerate}
                className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700"
              >
                Yes
              </button>
              <button
                onClick={handleCancelRegenerate}
                className="rounded-md bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-800 dark:text-amber-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        <p className="text-sm leading-relaxed text-text-secondary">{personality!.summary}</p>

        {/* Preferences as Badges */}
        {preferenceBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {preferenceBadges.map((pref, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {pref}
              </span>
            ))}
          </div>
        )}

        {/* Generated timestamp */}
        {personality!.generatedAt && (
          <p className="text-xs text-text-tertiary">
            Generated {formatGeneratedDate(personality!.generatedAt)}
          </p>
        )}
      </div>
    );
  }

  // Render empty state (waiting for data or no customer data)
  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium text-text-primary">
        Relationship Understanding (Draft)
      </h2>
      <div className="flex items-center gap-3 py-2">
        {customerData ? (
          <>
            <p className="text-sm text-text-tertiary">No personality profile yet</p>
            <button
              onClick={generatePersonality}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              Generate
            </button>
          </>
        ) : (
          <p className="text-sm text-text-tertiary">Waiting for customer data...</p>
        )}
      </div>
    </div>
  );
}
