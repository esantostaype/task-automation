/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from "react";
import { Select, Option, Chip, FormLabel, Button, Alert } from "@mui/joy";
import { User } from "@/interfaces";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserCheck01Icon,
  RefreshIcon,
  SparklesIcon,
  Calendar04Icon,
  Clock03Icon,
  Brain02Icon,
} from "@hugeicons/core-free-icons";
import { TextFieldError } from "@/components";
import { useEnhancedUsers } from "@/hooks";

interface UserAssignmentSelectProps {
  users: User[]; // Fallback users
  values: string[];
  onChange: (value: string[]) => void;
  suggestedUser?: User | null;
  fetchingSuggestion: boolean;
  touched: boolean | undefined;
  error: string | undefined;
  loading?: boolean;
  userHasManuallyChanged?: boolean;
  onApplySuggestion?: () => void;
  // Props for enhanced analysis
  typeId?: number;
  brandId?: string;
  durationDays?: number;
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
  typeId,
  brandId,
  durationDays,
}) => {
  // State for vacation warnings
  const [vacationWarnings, setVacationWarnings] = useState<string[]>([]);

  // Enhanced users hook
  const {
    allUsers,
    overloadedUsers,
    smartSuggestion,
    totalCompatible,
    totalAvailable,
    totalOnVacation,
    loading: loadingEnhanced,
    error: enhancedError,
    hasRequiredParams,
    getUserById,
    getVacationWarning,
    message,
  } = useEnhancedUsers({
    typeId,
    brandId,
    durationDays: durationDays ? parseFloat(durationDays.toString()) : undefined,
    enabled: Boolean(typeId && durationDays),
  });

  // Determine which users to show
  const usersToShow = hasRequiredParams ? allUsers : users;
  const isUsingEnhancedUsers = hasRequiredParams && !loadingEnhanced;
  
  // Determine loading state
  const isLoading = loading || loadingEnhanced || fetchingSuggestion;

  // Update vacation warnings when selected users change
  useEffect(() => {
    if (!isUsingEnhancedUsers || values.length === 0) {
      setVacationWarnings([]);
      return;
    }

    const warnings: string[] = [];
    values.forEach(userId => {
      const warning = getVacationWarning(userId);
      if (warning) {
        warnings.push(warning);
      }
    });

    setVacationWarnings(warnings);
  }, [values, isUsingEnhancedUsers, getVacationWarning]);

  const getPlaceholder = () => {
    if (fetchingSuggestion) return "Searching for suggestion..";
    if (loadingEnhanced) return "Analyzing availability...";
    if (loading) return "Loading designers...";
    return "Assign Designer(s)";
  };

  // Smart suggestion info
  const shouldShowSmartSuggestion = () => {
    return (
      smartSuggestion && 
      !fetchingSuggestion && 
      !values.includes(smartSuggestion.userId) &&
      totalAvailable === 0 // Only show when no immediately available users
    );
  };

  // Regular suggestion info
  const shouldShowRegularSuggestion = () => {
    return (
      suggestedUser && 
      !fetchingSuggestion && 
      !values.includes(suggestedUser.id) &&
      (!smartSuggestion || totalAvailable > 0) // Don't show if smart suggestion is more relevant
    );
  };

  // Get user status info for display
  const getUserStatusInfo = (userId: string) => {
    if (!isUsingEnhancedUsers) return null;
    return getUserById(userId);
  };

  // Get status color for chips and options
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'on_vacation': return 'warning';
      case 'overloaded': return 'danger';
      default: return 'neutral';
    }
  };

  // Get status icon
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'on_vacation': return Calendar04Icon;
      case 'overloaded': return Clock03Icon;
      default: return UserCheck01Icon;
    }
  };

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon icon={UserCheck01Icon} size={20} strokeWidth={1.5} />
        Assignee
        {isUsingEnhancedUsers && (
          <span className="text-xs text-gray-400 ml-2">
            ({totalAvailable} available, {totalOnVacation} on vacation of {totalCompatible} total)
          </span>
        )}
      </FormLabel>

      {/* Smart Suggestion Alert */}
      {shouldShowSmartSuggestion() && smartSuggestion && (
        <Alert 
          variant="soft" 
          color="primary" 
          className="mb-3"
          startDecorator={<HugeiconsIcon icon={Brain02Icon} size={20} />}
        >
          <div>
            <div className="font-medium">💡 Smart Suggestion</div>
            <div className="text-sm mt-1">
              {smartSuggestion.reason}
              <br />
              <strong>Alternative start date:</strong> {smartSuggestion.alternativeStartDate}
            </div>
            <Button
              size="sm"
              variant="outlined"
              color="primary"
              className="mt-2"
              onClick={() => {
                onChange([smartSuggestion.userId]);
                if (onApplySuggestion) onApplySuggestion();
              }}
              startDecorator={<HugeiconsIcon icon={Brain02Icon} size={16} />}
            >
              Use Smart Suggestion
            </Button>
          </div>
        </Alert>
      )}

      {/* Regular Suggestion */}
      {shouldShowRegularSuggestion() && suggestedUser && (
        <div className="mb-3 p-3 bg-accent/20 border border-accent/30 rounded-lg">
          <div>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-sm text-accent-200">
                Suggested: <strong>{suggestedUser.name}</strong>
                {isUsingEnhancedUsers && (
                  <span className="text-xs text-green-400 ml-2">✓ Available now</span>
                )}
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

      {/* Vacation Warnings */}
      {vacationWarnings.length > 0 && (
        <div className="mb-3 space-y-2">
          {vacationWarnings.map((warning, index) => (
            <Alert 
              key={index}
              variant="soft" 
              color="warning" 
              startDecorator={<HugeiconsIcon icon={Calendar04Icon} size={20} />}
            >
              <div className="text-sm">{warning}</div>
            </Alert>
          ))}
        </div>
      )}

      {/* Availability Summary */}
      {isUsingEnhancedUsers && totalCompatible > 0 && (
        <div className="mb-3 text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span className="text-green-400">✓ {totalAvailable} available</span>
            <span className="text-yellow-400">🏖️ {totalOnVacation} on vacation</span>
            <span className="text-red-400">📈 {overloadedUsers.length} overloaded</span>
          </div>
        </div>
      )}

      {/* Main Select */}
      <Select
        name="assignedUserIds"
        multiple
        value={values}
        key={values.join(",")}
        onChange={(_, val) => onChange(val as string[])}
        placeholder={getPlaceholder()}
        disabled={isLoading}
        color={touched && error ? "danger" : "neutral"}
        renderValue={(selected) => {
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
                const user = usersToShow.find((u) => u.id === selectedId.value);
                const userStatus = getUserStatusInfo(user?.id || '');
                const isSuggested = suggestedUser?.id === user?.id;
                const isSmartSuggested = smartSuggestion?.userId === user?.id;

                return user ? (
                  <Chip
                    key={user.id}
                    color={isSuggested || isSmartSuggested ? "primary" : getStatusColor(userStatus?.status)}
                    variant="soft"
                  >
                    {user.name}
                    {userStatus?.isSpecialist && <span className="text-xs ml-1">⭐</span>}
                    {userStatus?.status === 'on_vacation' && <span className="text-xs ml-1">🏖️</span>}
                    {userStatus?.status === 'overloaded' && <span className="text-xs ml-1">📈</span>}
                  </Chip>
                ) : null;
              })}
            </div>
          );
        }}
      >
        {isLoading ? (
          <Option value="" disabled>
            {getPlaceholder()}
          </Option>
        ) : usersToShow.length === 0 ? (
          <Option value="" disabled>
            No compatible designers found
          </Option>
        ) : (
          usersToShow.map((user) => {
            const userStatus = getUserStatusInfo(user.id);
            const isSuggested = suggestedUser?.id === user.id;
            const isSmartSuggested = smartSuggestion?.userId === user.id;
            const StatusIcon = getStatusIcon(userStatus?.status);

            return (
              <Option key={user.id} value={user.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={StatusIcon} size={16} />
                    <span>{user.name}</span>
                    {userStatus?.isSpecialist && (
                      <span className="text-xs text-yellow-400">⭐ Specialist</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs">
                    {/* Status badge */}
                    <span className={`px-2 py-1 rounded text-xs ${
                      userStatus?.status === 'available' ? 'bg-green-900 text-green-300' :
                      userStatus?.status === 'on_vacation' ? 'bg-yellow-900 text-yellow-300' :
                      userStatus?.status === 'overloaded' ? 'bg-red-900 text-red-300' :
                      'bg-gray-900 text-gray-300'
                    }`}>
                      {userStatus?.status === 'available' ? 'Available' :
                       userStatus?.status === 'on_vacation' ? 'On Vacation' :
                       userStatus?.status === 'overloaded' ? 'Overloaded' :
                       'Unknown'}
                    </span>

                    {/* Available from date */}
                    {userStatus && (
                      <span className="text-gray-400">
                        from {userStatus.availableFrom}
                      </span>
                    )}

                    {/* Suggestion indicators */}
                    {isSuggested && (
                      <span className="text-blue-400 flex items-center gap-1">
                        <HugeiconsIcon icon={SparklesIcon} size={14} />
                        Suggested
                      </span>
                    )}
                    
                    {isSmartSuggested && (
                      <span className="text-purple-400 flex items-center gap-1">
                        <HugeiconsIcon icon={Brain02Icon} size={14} />
                        Smart Pick
                      </span>
                    )}
                  </div>
                </div>
              </Option>
            );
          })
        )}
      </Select>

      {/* Error display */}
      {touched && error && <TextFieldError label={error} />}
      
      {/* Enhanced users API error */}
      {enhancedError && (
        <div className="text-sm text-red-400 mt-2">
          Failed to load enhanced analysis: {enhancedError}
        </div>
      )}

      {/* Status message */}
      {isUsingEnhancedUsers && message && (
        <div className="text-xs text-gray-500 mt-2">
          {message}
        </div>
      )}

      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && isUsingEnhancedUsers && (
        <div className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
          <div>Debug: Enhanced analysis active</div>
          {smartSuggestion && (
            <div>Smart suggestion: {smartSuggestion.reason}</div>
          )}
        </div>
      )}
    </div>
  );
};