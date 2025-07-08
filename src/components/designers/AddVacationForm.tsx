import React, { useState } from 'react';
import { Button, Input, FormControl, FormLabel } from '@mui/joy';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';

interface AddVacationFormProps {
  onAdd: (startDate: string, endDate: string) => void;
  loading?: boolean;
}

export const AddVacationForm: React.FC<AddVacationFormProps> = ({
  onAdd,
  loading = false
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleAdd = () => {
    if (startDate && endDate) {
      onAdd(startDate, endDate);
      setStartDate('');
      setEndDate('');
    }
  };

  return (
    <div className="flex gap-2 mt-3">
      <FormControl sx={{ flex: 1 }}>
        <FormLabel>Start Date</FormLabel>
        <Input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </FormControl>
      
      <FormControl sx={{ flex: 1 }}>
        <FormLabel>End Date</FormLabel>
        <Input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </FormControl>
      
      <Button
        variant="soft"
        color="success"
        startDecorator={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
        onClick={handleAdd}
        disabled={!startDate || !endDate}
        loading={loading}
        sx={{ mt: 'auto' }}
      >
        Add Vacation
      </Button>
    </div>
  );
};