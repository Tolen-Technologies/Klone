interface TimelineEvent {
  date: string;
  description: string;
}

// 5 predefined timelines for demo purposes
const PREDEFINED_TIMELINES: TimelineEvent[][] = [
  // Timeline 1: Active hotel customer
  [
    { date: '2024-12-28', description: 'Booking hotel Westin Resort Bali untuk 3 malam' },
    { date: '2024-12-15', description: 'Menerima campaign promo akhir tahun via email' },
    { date: '2024-11-20', description: 'WhatsApp inquiry tentang paket honeymoon' },
    { date: '2024-10-05', description: 'Check-out dari Grand Hyatt Jakarta' },
    { date: '2024-10-02', description: 'Check-in di Grand Hyatt Jakarta (2 malam)' },
    { date: '2024-09-15', description: 'Kunjungan ke branch Senayan City untuk konsultasi travel' },
    { date: '2024-08-22', description: 'Menerima campaign member birthday discount' },
    { date: '2024-07-10', description: 'Transaksi paket tour Lombok 4D3N' },
  ],
  // Timeline 2: Frequent flyer customer
  [
    { date: '2024-12-30', description: 'Pembelian tiket pesawat Jakarta-Singapore PP' },
    { date: '2024-12-20', description: 'WhatsApp konfirmasi e-ticket' },
    { date: '2024-12-01', description: 'Menerima campaign year-end sale flights' },
    { date: '2024-11-15', description: 'Transaksi tiket Jakarta-Bali untuk keluarga' },
    { date: '2024-10-28', description: 'Kunjungan ke branch Plaza Indonesia' },
    { date: '2024-10-10', description: 'Refund tiket karena perubahan jadwal' },
    { date: '2024-09-05', description: 'Pembelian tiket Jakarta-Surabaya bisnis class' },
    { date: '2024-08-18', description: 'Upgrade membership ke Gold status' },
  ],
  // Timeline 3: Tour package enthusiast
  [
    { date: '2024-12-25', description: 'Inquiry paket Jepang musim sakura via WhatsApp' },
    { date: '2024-12-10', description: 'Menerima campaign winter holiday packages' },
    { date: '2024-11-28', description: 'Selesai tour Korea 7D6N' },
    { date: '2024-11-22', description: 'Berangkat tour Korea dengan group' },
    { date: '2024-11-01', description: 'Pembayaran lunas paket Korea' },
    { date: '2024-10-15', description: 'DP booking paket tour Korea' },
    { date: '2024-10-10', description: 'Kunjungan ke branch Gandaria City untuk konsultasi' },
    { date: '2024-09-20', description: 'Menerima campaign early bird tour packages 2025' },
  ],
  // Timeline 4: Corporate/business traveler
  [
    { date: '2024-12-27', description: 'Booking meeting room di hotel untuk event perusahaan' },
    { date: '2024-12-18', description: 'WhatsApp request invoice untuk reimburse' },
    { date: '2024-12-05', description: 'Check-out JW Marriott (business trip)' },
    { date: '2024-12-03', description: 'Check-in JW Marriott Jakarta' },
    { date: '2024-11-25', description: 'Menerima campaign corporate rates 2025' },
    { date: '2024-11-10', description: 'Transaksi 5 tiket pesawat untuk tim' },
    { date: '2024-10-22', description: 'Setup corporate account dengan perusahaan' },
    { date: '2024-10-15', description: 'Kunjungan ke branch untuk corporate partnership' },
  ],
  // Timeline 5: Family vacation planner
  [
    { date: '2024-12-29', description: 'WhatsApp tanya promo family package' },
    { date: '2024-12-20', description: 'Menerima campaign school holiday specials' },
    { date: '2024-12-01', description: 'Booking villa di Bali untuk liburan keluarga' },
    { date: '2024-11-18', description: 'Inquiry theme park tickets Singapore' },
    { date: '2024-11-05', description: 'Kunjungan ke branch bersama keluarga' },
    { date: '2024-10-20', description: 'Selesai family trip ke Jogja' },
    { date: '2024-10-17', description: 'Berangkat family trip Jogja 4D3N' },
    { date: '2024-09-30', description: 'Pembayaran paket Jogja family' },
  ],
];

interface InteractionHistoryProps {
  customerId: string;
}

export default function InteractionHistory({ customerId }: InteractionHistoryProps) {
  // Select timeline based on customer ID (deterministic)
  const customerIdNum = parseInt(customerId, 10) || 0;
  const timelineIndex = customerIdNum % PREDEFINED_TIMELINES.length;
  const timeline = PREDEFINED_TIMELINES[timelineIndex];

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-text-primary">Interaction History</h3>

      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border-light" />

        {timeline.map((event, index) => (
          <div key={index} className="relative flex gap-4 pb-4 last:pb-0">
            {/* Bullet point */}
            <div className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-blue-500 bg-white dark:bg-gray-800" />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary">{event.description}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">{formatDate(event.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
