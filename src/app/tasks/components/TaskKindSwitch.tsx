import React from 'react'
import { Typography, Switch } from '@mui/joy'

interface TaskKindSwitchProps {
  selectedKind: 'UX/UI' | 'Graphic'
  onKindChange: (kind: 'UX/UI' | 'Graphic') => void
}

export const TaskKindSwitch: React.FC<TaskKindSwitchProps> = ({ 
  selectedKind, 
  onKindChange 
}) => (
  <div className="flex items-center mb-4 gap-2">
    <Typography level="body-sm">UX/UI</Typography>
    <Switch
      checked={selectedKind === 'Graphic'}
      onChange={() => onKindChange(selectedKind === 'UX/UI' ? 'Graphic' : 'UX/UI')}
    />
    <Typography level="body-sm">Graphic</Typography>
  </div>
)