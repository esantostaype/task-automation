/* eslint-disable react/no-unescaped-entities */
"use client";

import React from "react";
import { Select, Option, Chip, FormLabel, Button } from "@mui/joy";
import { User } from "@/interfaces";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserCheck01Icon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { TextFieldError } from "@/components";

interface UserAssignmentSelectProps {
  users: User[];
  values: string[];
  onChange: (value: string[]) => void;
  suggestedUser?: User | null;
  fetchingSuggestion: boolean;
  touched: boolean | undefined;
  error: string | undefined;
  loading?: boolean;
  userHasManuallyChanged?: boolean;
  onApplySuggestion?: () => void;
}

export const UserAssignmentSelect: React.FC<UserAssignmentSelectProps> = ({
  users,
  values,
  onChange,
  suggestedUser,
  fetchingSuggestion,
  touched,
  error,
  loading = false,
  userHasManuallyChanged = false,
  onApplySuggestion,
}) => {
  const getPlaceholder = () => {
    if (fetchingSuggestion) return "Searching for suggestion..";
    if (loading) return "Loading designers...";
    return "Assign Designer(s)";
  };

  // ✅ NUEVA FUNCIÓN: Determinar si mostrar información de sugerencia
  const shouldShowSuggestionInfo = () => {
    return (
      suggestedUser && !fetchingSuggestion && !values.includes(suggestedUser.id)
    );
  };

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon icon={UserCheck01Icon} size={20} strokeWidth={1.5} />
        Assignee
      </FormLabel>

      {shouldShowSuggestionInfo() && suggestedUser && (
        <div className="mb-3 p-3 bg-accent/20 border border-accent/30 rounded-lg">
          <div>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-sm text-accent-200">
                Suggested: <strong>{suggestedUser.name}</strong>
              </span>

              {onApplySuggestion && (
                <Button
                  size="sm"
                  variant="soft"
                  color="primary"
                  onClick={() => {
                    onChange([suggestedUser.id]);
                    onApplySuggestion();
                  }}
                  startDecorator={
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      size={16}
                      strokeWidth={2}
                    />
                  }
                >
                  Apply
                </Button>
              )}
            </div>
            {userHasManuallyChanged && (
              <p className="text-xs text-gray-400 mt-2">
                You've made manual changes. Click "Apply" to use the suggestion.
              </p>
            )}
          </div>
        </div>
      )}

      <Select
        name="assignedUserIds"
        multiple
        value={values}
        key={values.join(",")}
        onChange={(_, val) => onChange(val as string[])}
        placeholder={getPlaceholder()}
        disabled={fetchingSuggestion || loading}
        // ✅ NUEVO: Mostrar error visual en el select
        color={touched && error ? "danger" : "neutral"}
        renderValue={(selected) => {
          // ✅ NUEVO: Mostrar placeholder cuando no hay selección
          if (selected.length === 0) {
            return (
              <span style={{ color: 'var(--joy-palette-text-tertiary)' }}>
                {getPlaceholder()}
              </span>
            );
          }

          const orderedSelected = [...selected].sort((a, b) => {
            if (a.value === suggestedUser?.id) return -1;
            if (b.value === suggestedUser?.id) return 1;
            return 0;
          });

          return (
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {orderedSelected.map((selectedId) => {
                const user = users.find((u) => u.id === selectedId.value);
                const isSuggested = suggestedUser?.id === user?.id;

                return user ? (
                  <Chip
                    key={user.id}
                    color={isSuggested ? "primary" : "warning"}
                    variant="soft"
                  >
                    {user.name}
                  </Chip>
                ) : null;
              })}
            </div>
          );
        }}
      >
        {loading ? (
          <Option value="" disabled>
            Loading designers...
          </Option>
        ) : (
          users.map((user) => {
            const isSuggested = suggestedUser?.id === user.id;

            return (
              <Option key={user.id} value={user.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{user.name}</span>
                  <div className="flex items-center gap-1">
                    {isSuggested && (
                      <span className="text-xs text-blue-400 flex items-center gap-1">
                        <HugeiconsIcon
                          icon={SparklesIcon}
                          size={16}
                          strokeWidth={1.5}
                        />
                        Suggested
                      </span>
                    )}
                  </div>
                </div>
              </Option>
            );
          })
        )}
      </Select>

      {/* ✅ CORRECCIÓN: Asegurar que el error se muestre */}
      {touched && error && <TextFieldError label={error} />}
    </div>
  );
};