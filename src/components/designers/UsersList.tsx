import React from "react";
import { UserCard } from "./UserCard";
import { HugeiconsIcon } from "@hugeicons/react";
import { SearchListIcon } from "@hugeicons/core-free-icons";
import { LinearProgress } from "@mui/joy";

interface User {
  clickupId: string;
  name: string;
  email: string;
  profilePicture: string;
  initials: string;
  color: string;
  existsInLocal: boolean;
  canSync: boolean;
  lastActive?: string;
}

interface UsersListProps {
  users: User[];
  selectedUsers: Set<string>;
  onUserSelect: (userId: string, selected: boolean) => void;
  onUserEdit: (userId: string) => void;
  loading?: boolean;
}

export const UsersList: React.FC<UsersListProps> = ({
  users,
  selectedUsers,
  onUserSelect,
  onUserEdit,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center relative max-w-5xl mx-auto">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <HugeiconsIcon icon={SearchListIcon} size={24} />
            <p>Getting ClickUp users...</p>
          </div>
          <LinearProgress />
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <HugeiconsIcon
            icon={SearchListIcon}
            size={48}
            className="mx-auto mb-4 text-gray-400"
          />
          <h3 className="text-2xl font-medium mb-2">No users found</h3>
          <p className="text-gray-400">
            Check ClickUp API configuration or try refreshing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      {users.map((user) => (
        <UserCard
          key={user.clickupId}
          user={user}
          isSelected={selectedUsers.has(user.clickupId)}
          onSelect={(selected) => onUserSelect(user.clickupId, selected)}
          onEdit={() => onUserEdit(user.clickupId)}
          showSelection={!user.existsInLocal}
        />
      ))}
    </div>
  );
};
