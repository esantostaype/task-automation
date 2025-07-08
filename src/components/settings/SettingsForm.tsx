/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
// src/components/settings/SettingsForm.tsx
'use client'
import React, { useState, useEffect } from 'react'
import { 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Input, 
  Switch, 
  FormControl, 
  FormLabel,
  Divider,
  Alert,
  LinearProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  Tooltip
} from '@mui/joy'
import { HugeiconsIcon } from '@hugeicons/react'
import { 
  Settings01Icon, 
  RefreshIcon, 
  Download04Icon,
  Alert01Icon,
  InformationCircleIcon,
  Rotate02Icon
} from '@hugeicons/core-free-icons'
import { useSettings, useUpdateSettings, useResetSettings } from '@/hooks/useSettings'

interface SettingValue {
  category: string
  key: string
  value: any
  hasChanged: boolean
}

export const SettingsForm: React.FC = () => {
  const { data: settingsData, isLoading, error } = useSettings()
  const updateSettingsMutation = useUpdateSettings()
  const resetSettingsMutation = useResetSettings()
  
  const [settingValues, setSettingValues] = useState<Record<string, SettingValue>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    work_schedule: true // Expand work schedule by default
  })

  // Initialize setting values when data loads
  useEffect(() => {
    if (settingsData?.settings) {
      const initialValues: Record<string, SettingValue> = {}
      
      Object.entries(settingsData.settings).forEach(([groupName, settings]) => {
        settings.forEach(setting => {
          const key = `${setting.category}.${setting.key}`
          initialValues[key] = {
            category: setting.category,
            key: setting.key,
            value: setting.value,
            hasChanged: false
          }
        })
      })
      
      setSettingValues(initialValues)
      setHasChanges(false)
    }
  }, [settingsData])

  // Handle input changes
  const handleSettingChange = (category: string, key: string, newValue: any) => {
    const settingKey = `${category}.${key}`
    const originalSetting = settingsData?.settings && 
      Object.values(settingsData.settings)
        .flat()
        .find(s => s.category === category && s.key === key)
    
    const hasChanged = originalSetting ? originalSetting.value !== newValue : false
    
    setSettingValues(prev => ({
      ...prev,
      [settingKey]: {
        category,
        key,
        value: newValue,
        hasChanged
      }
    }))

    // Check if any setting has changed
    const anyChanged = Object.values({
      ...settingValues,
      [settingKey]: { category, key, value: newValue, hasChanged }
    }).some(setting => setting.hasChanged)
    
    setHasChanges(anyChanged)
  }

  // Handle form submission
  const handleSave = async () => {
    const changedSettings = Object.values(settingValues)
      .filter(setting => setting.hasChanged)
      .map(setting => ({
        category: setting.category,
        key: setting.key,
        value: setting.value
      }))

    if (changedSettings.length === 0) {
      return
    }

    await updateSettingsMutation.mutateAsync(changedSettings)
  }

  // Handle reset to defaults
  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset ALL settings to their default values? This action cannot be undone.')) {
      await resetSettingsMutation.mutateAsync()
    }
  }

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  // Render input based on data type
  const renderSettingInput = (setting: any) => {
    const settingKey = `${setting.category}.${setting.key}`
    const currentValue = settingValues[settingKey]?.value ?? setting.value
    const hasChanged = settingValues[settingKey]?.hasChanged ?? false

    switch (setting.dataType) {
      case 'boolean':
        return (
          <Switch
            checked={Boolean(currentValue)}
            onChange={(event) => handleSettingChange(setting.category, setting.key, event.target.checked)}
            color={hasChanged ? 'warning' : 'primary'}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={currentValue.toString()}
            onChange={(event) => {
              const value = parseFloat(event.target.value)
              if (!isNaN(value)) {
                handleSettingChange(setting.category, setting.key, value)
              }
            }}
            slotProps={{
              input: {
                min: setting.minValue,
                max: setting.maxValue,
                step: setting.key.includes('duration') ? 0.1 : 1
              }
            }}
            color={hasChanged ? 'warning' : 'neutral'}
          />
        )

      default:
        return (
          <Input
            value={currentValue.toString()}
            onChange={(event) => handleSettingChange(setting.category, setting.key, event.target.value)}
            color={hasChanged ? 'warning' : 'neutral'}
          />
        )
    }
  }

  // Group name mapping for better display
  const getGroupDisplayName = (groupName: string) => {
    const mapping: Record<string, string> = {
      work_schedule: 'Work Schedule',
      task_assignment: 'Task Assignment',
      tier_settings: 'Tier Settings',
      performance: 'Performance & Cache',
      validation: 'Validation Rules',
      clickup: 'ClickUp Integration',
      ui: 'User Interface'
    }
    return mapping[groupName] || groupName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={Settings01Icon} size={20} />
          <Typography level="title-md">Loading Settings...</Typography>
        </div>
        <LinearProgress />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert color="danger" variant="soft">
          <Typography level="title-sm">Failed to load settings</Typography>
          <Typography level="body-sm">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </Typography>
        </Alert>
      </div>
    )
  }

  if (!settingsData?.settings) {
    return (
      <div className="p-8">
        <Alert color="neutral" variant="soft">
          <Typography>No settings available</Typography>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Settings01Icon} size={24} />
          <Typography level="h4">System Settings</Typography>
        </div>
        
        <div className="flex items-center gap-2">
          <Tooltip title="Reset all settings to defaults">
            <IconButton
              variant="outlined"
              color="danger"
              size="sm"
              onClick={handleReset}
              loading={resetSettingsMutation.isPending}
            >
              <HugeiconsIcon icon={Rotate02Icon} size={16} />
            </IconButton>
          </Tooltip>
          
          <Button
            startDecorator={<HugeiconsIcon icon={Download04Icon} size={16} />}
            onClick={handleSave}
            disabled={!hasChanges}
            loading={updateSettingsMutation.isPending}
            color={hasChanges ? 'warning' : 'primary'}
          >
            {hasChanges ? 'Save Changes' : 'No Changes'}
          </Button>
        </div>
      </div>

      {/* Warning for changes */}
      {hasChanges && (
        <Alert color="warning" variant="soft">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Alert01Icon} size={16} />
            <Typography level="body-sm">
              You have unsaved changes. Don't forget to save your settings.
            </Typography>
          </div>
        </Alert>
      )}

      {/* Settings Groups */}
      <div className="space-y-4">
        {Object.entries(settingsData.settings).map(([groupName, settings]) => (
          <Accordion 
            key={groupName}
            expanded={expandedGroups[groupName] || false}
            onChange={() => toggleGroup(groupName)}
          >
            <AccordionSummary>
              <Typography level="title-md">
                {getGroupDisplayName(groupName)}
              </Typography>
              <Typography level="body-sm" className="ml-2 text-gray-400">
                ({settings.length} settings)
              </Typography>
            </AccordionSummary>
            
            <AccordionDetails>
              <div className="space-y-4">
                {settings.map((setting) => {
                  const settingKey = `${setting.category}.${setting.key}`
                  const hasChanged = settingValues[settingKey]?.hasChanged ?? false
                  
                  return (
                    <Card key={settingKey} variant="outlined">
                      <CardContent>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Typography level="title-sm">
                                {setting.label}
                              </Typography>
                              {hasChanged && (
                                <div className="w-2 h-2 bg-orange-500 rounded-full" title="Changed" />
                              )}
                              {setting.description && (
                                <Tooltip title={setting.description}>
                                  <HugeiconsIcon 
                                    icon={InformationCircleIcon} 
                                    size={14} 
                                    className="text-gray-400 cursor-help" 
                                  />
                                </Tooltip>
                              )}
                            </div>
                            
                            {setting.description && (
                              <Typography level="body-xs" className="text-gray-500 mb-2">
                                {setting.description}
                              </Typography>
                            )}
                            
                            <Typography level="body-xs" className="text-gray-400 font-mono">
                              {setting.category}.{setting.key}
                            </Typography>
                            
                            {/* Validation info */}
                            {(setting.minValue !== null || setting.maxValue !== null) && (
                              <Typography level="body-xs" className="text-gray-500 mt-1">
                                Range: {setting.minValue ?? '∞'} - {setting.maxValue ?? '∞'}
                              </Typography>
                            )}
                          </div>
                          
                          <div className="flex-shrink-0">
                            <FormControl>
                              {renderSettingInput(setting)}
                            </FormControl>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </AccordionDetails>
          </Accordion>
        ))}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-gray-700">
        <Typography level="body-xs" className="text-gray-500 text-center">
          Total settings: {settingsData.totalSettings} • 
          Groups: {settingsData.groups.length} • 
          Changes will take effect immediately after saving
        </Typography>
      </div>
    </div>
  )
}