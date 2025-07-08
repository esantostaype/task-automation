
import React from 'react';
import { IconButton } from '@mui/joy';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

interface UserVacationRowProps {
  vacation: {
    id: number;
    startDate: string;
    endDate: string;
  };
  onDelete: (vacationId: number) => void;
  deleting?: boolean;
  loading?: boolean; // Added loading prop
}

export const UserVacationRow: React.FC<UserVacationRowProps> = ({
  vacation,
  onDelete,
  deleting = false,
  loading = false // Default to false
}) => {
  const startDate = new Date(vacation.startDate);
  const endDate = new Date(vacation.endDate);
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <tr className="border-b border-white/10 text-sm">
      <td className="px-3 py-2">{loading ? 'Loading...' : startDate.toLocaleDateString()}</td>
      <td className="px-3 py-2">{loading ? 'Loading...' : endDate.toLocaleDateString()}</td>
      <td className="px-3 py-2">{loading ? 'Loading...' : `${durationDays} days`}</td>
      <td className="px-3 py-2">
        {loading ? (
          'Loading...'
        ) : (
          <IconButton
            size="sm"
            color="danger"
            variant="soft"
            onClick={() => onDelete(vacation.id)}
            loading={deleting}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </IconButton>
        )}
      </td>
    </tr>
  );
};
