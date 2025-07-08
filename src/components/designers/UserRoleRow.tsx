import React from 'react';
import { IconButton } from '@mui/joy';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

interface UserRoleRowProps {
  role: {
    id: number;
    type: { name: string };
    brand?: { name: string } | null;
  };
  onDelete: (roleId: number) => void;
  deleting?: boolean;
}

export const UserRoleRow: React.FC<UserRoleRowProps> = ({
  role,
  onDelete,
  deleting = false
}) => {
  return (
    <tr className="border-b border-white/10">
      <td className="px-3 py-2">{role.type.name}</td>
      <td className="px-3 py-2">{role.brand?.name || 'Global'}</td>
      <td className="px-3 py-2">
        <IconButton
          size="sm"
          color="danger"
          variant="soft"
          onClick={() => onDelete(role.id)}
          loading={deleting}
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
        </IconButton>
      </td>
    </tr>
  );
};