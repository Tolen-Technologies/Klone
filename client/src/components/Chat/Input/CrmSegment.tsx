import React, { memo } from 'react';
import { Users } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useBadgeRowContext } from '~/Providers';

function CrmSegment() {
  const { crmSegment } = useBadgeRowContext();
  const { toggleState: crmSegmentEnabled, debouncedChange, isPinned } = crmSegment;

  return (
    <>
      {(crmSegmentEnabled || isPinned) && (
        <CheckboxButton
          className="max-w-fit"
          checked={crmSegmentEnabled}
          setValue={debouncedChange}
          label="Create Segment"
          isCheckedClassName="border-purple-600/40 bg-purple-500/10 hover:bg-purple-700/10"
          icon={<Users className="icon-md" />}
        />
      )}
    </>
  );
}

export default memo(CrmSegment);
