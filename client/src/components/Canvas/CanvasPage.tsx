import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import { request } from 'librechat-data-provider';
import ChatSidebar from './ChatSidebar';
import NotesEditor from './NotesEditor';
import PersonalitySection from './PersonalitySection';
import RecordingSection from './RecordingSection';
import TranscriptsList from './TranscriptsList';
import FactsProcessingModal from './FactsProcessingModal';
import BookmarksModal from './BookmarksModal';
import InteractionHistory from './InteractionHistory';

const LAST_VISITED_SEGMENT_KEY = 'lastVisitedSegmentId';

// Human-friendly labels for database column names
const FIELD_LABELS: Record<string, string> = {
  // Customer identifiers
  custid: 'Customer ID',
  custcode: 'Customer Code',
  customercode: 'Customer Code',
  customerId: 'Customer ID',

  // Personal info
  custname: 'Name',
  customername: 'Customer Name',
  fullname: 'Full Name',
  firstname: 'First Name',
  lastname: 'Last Name',
  nickname: 'Nickname',
  gender: 'Gender',
  age: 'Age',
  birthdate: 'Birth Date',
  birthday: 'Birthday',
  dateofbirth: 'Date of Birth',

  // Contact info
  mobileno: 'Mobile Number',
  phoneno: 'Phone Number',
  phone: 'Phone',
  telephone: 'Telephone',
  whatsapp: 'WhatsApp',
  custemail: 'Email',
  email: 'Email',
  address: 'Address',
  city: 'City',
  province: 'Province',
  country: 'Country',
  postalcode: 'Postal Code',
  zipcode: 'ZIP Code',

  // Business info
  companyname: 'Company Name',
  company: 'Company',
  jobtitle: 'Job Title',
  occupation: 'Occupation',
  industry: 'Industry',

  // Account info
  joindate: 'Join Date',
  registrationdate: 'Registration Date',
  createddate: 'Created Date',
  lastvisit: 'Last Visit',
  lastlogin: 'Last Login',
  lastactivity: 'Last Activity',
  status: 'Status',
  membertype: 'Member Type',
  memberlevel: 'Member Level',
  tier: 'Tier',

  // Branch/location
  branchid: 'Branch ID',
  branchcode: 'Branch Code',
  branchname: 'Branch',
  branch: 'Branch',
  outlet: 'Outlet',
  location: 'Location',

  // Financial
  totalspend: 'Total Spend',
  totalamount: 'Total Amount',
  balance: 'Balance',
  points: 'Points',
  creditlimit: 'Credit Limit',

  // Preferences
  preferredlanguage: 'Preferred Language',
  language: 'Language',
  currency: 'Currency',
  newsletter: 'Newsletter',
  marketingconsent: 'Marketing Consent',

  // Transactions
  transactioncount: 'Transaction Count',
  totaltransactions: 'Total Transactions',
  averageorder: 'Average Order',
  lastorderdate: 'Last Order Date',

  // Notes/misc
  notes: 'Notes',
  remarks: 'Remarks',
  tags: 'Tags',
  source: 'Source',
  referredby: 'Referred By',
};

// Get human-friendly label for a field
const getFieldLabel = (key: string): string => {
  const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
  return (
    FIELD_LABELS[lowerKey] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
  );
};

// Check if a field name indicates a date field
const isDateField = (key: string): boolean => {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('date') ||
    lowerKey.includes('birthday') ||
    lowerKey.includes('birthdate') ||
    lowerKey === 'createdat' ||
    lowerKey === 'updatedat' ||
    lowerKey === 'lastvisit' ||
    lowerKey === 'lastlogin' ||
    lowerKey === 'lastactivity'
  );
};

// Check if a value looks like a date string
const looksLikeDate = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  // Match ISO date format or common date patterns
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value);
};

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

interface CustomerPersonality {
  summary: string;
  preferences: string;
  generatedAt?: Date | string;
}

interface CustomerTranscript {
  id: string;
  filename: string;
  content: string;
  createdAt: Date | string;
}

interface BookmarkedFact {
  id: string;
  text: string;
  transcriptId?: string;
  createdAt: Date | string;
}

interface CustomerProfile {
  customerId: string;
  personality?: CustomerPersonality;
  notes?: string;
  transcripts?: CustomerTranscript[];
  bookmarkedFacts?: BookmarkedFact[];
  conversationId?: string;
}

export default function CanvasPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(true);

  // Transcripts and bookmarks state
  const [transcripts, setTranscripts] = useState<CustomerTranscript[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedFact[]>([]);
  const [processingTranscript, setProcessingTranscript] = useState<CustomerTranscript | null>(null);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);

  // Navigate back to last visited segment
  const handleBack = () => {
    const lastSegmentId = localStorage.getItem(LAST_VISITED_SEGMENT_KEY);
    if (lastSegmentId) {
      navigate(`/segments?selected=${lastSegmentId}`);
    } else {
      navigate('/segments');
    }
  };

  // Fetch customer data from CRM backend
  useEffect(() => {
    if (!customerId) {
      setIsLoadingCustomer(false);
      return;
    }

    const fetchCustomer = async () => {
      setIsLoadingCustomer(true);
      setCustomerError(null);
      try {
        const response = await fetch(`http://localhost:8000/api/customer/${customerId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch customer: ${response.statusText}`);
        }
        const data = await response.json();
        setCustomer(data);
      } catch (error) {
        console.error('Error fetching customer:', error);
        setCustomerError(error instanceof Error ? error.message : 'Failed to fetch customer data');
      } finally {
        setIsLoadingCustomer(false);
      }
    };

    fetchCustomer();
  }, [customerId]);

  // Fetch customer profile from LibreChat API
  useEffect(() => {
    if (!customerId) {
      setIsLoadingProfile(false);
      return;
    }

    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        const data = (await request.get(
          `/api/customer-profile/${customerId}`,
        )) as CustomerProfile | null;
        setProfile(data);
        // Populate transcripts and bookmarks from profile
        setTranscripts(data?.transcripts || []);
        setBookmarks(data?.bookmarkedFacts || []);
      } catch (error: unknown) {
        // Profile might not exist yet, which is ok (404)
        const err = error as { response?: { status?: number }; message?: string };
        if (err.response?.status === 404) {
          setProfile(null);
          setTranscripts([]);
          setBookmarks([]);
        } else {
          console.error('Error fetching profile:', error);
          setProfileError(err.message || 'Failed to fetch profile');
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [customerId]);

  const isLoading = isLoadingCustomer || isLoadingProfile;

  // Handle notes save callback - update local state with new notes
  const handleNotesSave = useCallback(
    (notes: string) => {
      setProfile((prev) => (prev ? { ...prev, notes } : { customerId: customerId || '', notes }));
    },
    [customerId],
  );

  // Handle personality update callback - update local state with new personality
  const handlePersonalityUpdate = useCallback(
    (personality: CustomerPersonality) => {
      setProfile((prev) =>
        prev ? { ...prev, personality } : { customerId: customerId || '', personality },
      );
    },
    [customerId],
  );

  // Handle new transcript added
  const handleTranscriptAdded = useCallback((transcript: CustomerTranscript) => {
    setTranscripts((prev) => [...prev, transcript]);
  }, []);

  // Handle bookmark added
  const handleBookmarkAdded = useCallback((bookmark: BookmarkedFact) => {
    setBookmarks((prev) => [...prev, bookmark]);
  }, []);

  // Handle bookmark removed
  const handleBookmarkRemoved = useCallback((factId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== factId));
  }, []);

  // Handle facts accepted from modal - append to notes
  const handleFactsProcessed = useCallback(
    async (acceptedFacts: string[]) => {
      if (acceptedFacts.length === 0) return;

      // Format facts as HTML list (ReactQuill uses HTML, not markdown)
      const factsHtml = '<ul>' + acceptedFacts.map((fact) => `<li>${fact}</li>`).join('') + '</ul>';

      // Get current notes and append with HTML formatting
      const currentNotes = profile?.notes || '';
      const separator = currentNotes.trim()
        ? '<p><br></p><p><strong>Fakta dari Percakapan</strong></p>'
        : '<p><strong>Fakta dari Percakapan</strong></p>';
      const newNotes = currentNotes + separator + factsHtml;

      try {
        // Save to backend
        await request.put(`/api/customer-profile/${customerId}/notes`, { notes: newNotes });
        // Update local state
        setProfile((prev) =>
          prev ? { ...prev, notes: newNotes } : { customerId: customerId || '', notes: newNotes },
        );
      } catch (error) {
        console.error('Error saving facts to notes:', error);
      }
    },
    [customerId, profile?.notes],
  );

  // Handle accepting a bookmark (add to notes)
  const handleAcceptBookmark = useCallback(
    async (text: string) => {
      // Use HTML list item (ReactQuill uses HTML, not markdown)
      const factHtml = `<ul><li>${text}</li></ul>`;
      const currentNotes = profile?.notes || '';
      const separator = currentNotes.trim() ? '<p><br></p>' : '';
      const newNotes = currentNotes + separator + factHtml;

      try {
        await request.put(`/api/customer-profile/${customerId}/notes`, { notes: newNotes });
        setProfile((prev) =>
          prev ? { ...prev, notes: newNotes } : { customerId: customerId || '', notes: newNotes },
        );
      } catch (error) {
        console.error('Error adding bookmark to notes:', error);
      }
    },
    [customerId, profile?.notes],
  );

  // Format date for display
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Get status badge color
  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      <div className="flex items-center gap-4 border-b border-border-light px-6 py-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div className="h-6 w-px bg-border-light" />
        <h1 className="text-xl font-semibold text-text-primary">
          {isLoading ? 'Loading...' : customer?.name || 'Customer Details'}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-8" />
            <p className="text-sm text-text-tertiary">Loading customer data...</p>
          </div>
        </div>
      ) : customerError ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-8 text-red-600 dark:text-red-300"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-text-primary">Failed to load customer</p>
            <p className="max-w-md text-sm text-text-tertiary">{customerError}</p>
            <button
              onClick={handleBack}
              className="mt-2 rounded-lg bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
            >
              Return to Segments
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div
            className={`scrollbar-hover flex-1 overflow-y-auto px-10 py-8 transition-all duration-300 ${
              isChatExpanded ? 'w-[65%]' : 'w-full'
            }`}
          >
            <div className="mx-auto max-w-4xl space-y-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-text-primary">
                    {customer?.name || 'Customer'}
                  </h2>
                  {customer?.status && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(customer.status)}`}
                    >
                      {customer.status}
                    </span>
                  )}
                </div>
                <div className="grid gap-2 text-sm text-text-secondary md:grid-cols-2">
                  <div>
                    Email: <span className="text-text-primary">{customer?.email || '-'}</span>
                  </div>
                  <div>
                    Phone: <span className="text-text-primary">{customer?.phone || '-'}</span>
                  </div>
                  <div>
                    Member Since:{' '}
                    <span className="text-text-primary">{formatDate(customer?.joinDate)}</span>
                  </div>
                  <div>
                    Birthday:{' '}
                    <span className="text-text-primary">{formatDate(customer?.birthday)}</span>
                  </div>
                </div>
              </div>

              {customer && Object.keys(customer).length > 6 && (
                <div className="space-y-2 text-sm text-text-secondary">
                  <h3 className="text-base font-medium text-text-primary">Details</h3>
                  <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                    {Object.entries(customer)
                      .filter(
                        ([key]) =>
                          ![
                            'id',
                            'name',
                            'email',
                            'phone',
                            'joinDate',
                            'birthday',
                            'status',
                          ].includes(key),
                      )
                      .map(([key, value]) => {
                        // Format dates nicely
                        let displayValue: string;
                        if (value == null) {
                          displayValue = '-';
                        } else if (typeof value === 'object') {
                          displayValue = JSON.stringify(value);
                        } else if (
                          (isDateField(key) || looksLikeDate(value)) &&
                          typeof value === 'string'
                        ) {
                          displayValue = formatDate(value);
                        } else {
                          displayValue = String(value);
                        }

                        return (
                          <div key={key} className="flex items-baseline gap-2">
                            <span className="shrink-0 text-text-tertiary">
                              {getFieldLabel(key)}:
                            </span>
                            <span className="text-text-primary">{displayValue}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {!isLoadingProfile && (
                <PersonalitySection
                  customerId={customerId || ''}
                  customerData={customer}
                  initialPersonality={profile?.personality}
                  profileLoaded={!isLoadingProfile}
                  onPersonalityUpdate={handlePersonalityUpdate}
                />
              )}

              {/* Recording and Transcripts Section */}
              <RecordingSection
                customerId={customerId || ''}
                onTranscriptAdded={handleTranscriptAdded}
              />

              {transcripts.length > 0 && (
                <TranscriptsList
                  transcripts={transcripts}
                  onProcessTranscript={(transcript) => setProcessingTranscript(transcript)}
                />
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium text-text-primary">Notes</h3>
                  {bookmarks.length > 0 && (
                    <button
                      onClick={() => setShowBookmarksModal(true)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-yellow-600 transition-colors hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                    >
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
                      {bookmarks.length} Bookmarked
                    </button>
                  )}
                </div>
                <NotesEditor
                  initialValue={profile?.notes || ''}
                  customerId={customerId || ''}
                  onSave={handleNotesSave}
                />
              </div>

              {/* Interaction History */}
              <InteractionHistory customerId={customerId || ''} />
            </div>
          </div>

          <div className={`transition-all duration-300 ${isChatExpanded ? 'w-[35%]' : 'w-12'}`}>
            <ChatSidebar
              customerId={customerId || ''}
              customerData={customer}
              customerProfile={
                profile
                  ? {
                      customerId: profile.customerId,
                      personalitySummary: profile.personality?.summary,
                      preferences: profile.personality?.preferences
                        ? [profile.personality.preferences]
                        : undefined,
                      notes: profile.notes,
                      conversationId: profile.conversationId,
                    }
                  : null
              }
              isMinimized={!isChatExpanded}
              onToggleMinimize={() => setIsChatExpanded(!isChatExpanded)}
              onProfileUpdate={(updatedProfile) => {
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        conversationId: updatedProfile.conversationId,
                      }
                    : null,
                );
              }}
            />
          </div>
        </div>
      )}

      {/* Facts Processing Modal */}
      {processingTranscript && (
        <FactsProcessingModal
          transcript={processingTranscript}
          customerId={customerId || ''}
          onClose={() => setProcessingTranscript(null)}
          onFactsProcessed={handleFactsProcessed}
          onBookmarkAdded={handleBookmarkAdded}
        />
      )}

      {/* Bookmarks Modal */}
      {showBookmarksModal && (
        <BookmarksModal
          bookmarks={bookmarks}
          customerId={customerId || ''}
          onClose={() => setShowBookmarksModal(false)}
          onBookmarkRemoved={handleBookmarkRemoved}
          onAcceptBookmark={handleAcceptBookmark}
        />
      )}
    </div>
  );
}
