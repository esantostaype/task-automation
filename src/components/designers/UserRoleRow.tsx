// src/components/designers/UserRoleRow.tsx - FIXED VERSION
import React from 'react';
import { IconButton } from '@mui/joy';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { TableTd } from '@/components';

interface UserRoleRowProps {
  role: {
    id: number;
    type: { name: string };
    brand?: { name: string } | null;
  };
  onDelete: (roleId: number) => void;
  deleting?: boolean;
  loading?: boolean;
}

export const UserRoleRow: React.FC<UserRoleRowProps> = ({
  role,
  onDelete,
  deleting = false,
  loading = false
}) => {
  return (
    <tr className="border-b border-white/10 text-sm">
      <TableTd>{ loading ? 'Loading...' : role.type.name }</TableTd>
      <TableTd>{ loading ? 'Loading...' : ( role.brand?.name || 'Global' ) }</TableTd>
      <TableTd>
        {loading ? (
          'Loading...'
        ) : (
          <IconButton
            size="sm"
            color="danger"
            variant="soft"
            onClick={() => onDelete(role.id)}
            loading={deleting}
            disabled={deleting}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </IconButton>
        )}
      </TableTd>
    </tr>
  );
};