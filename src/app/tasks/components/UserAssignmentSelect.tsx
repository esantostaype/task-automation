// components/UserAssignmentSelect.tsx
'use client';

import React from 'react';
import { Select, Option, Typography, Chip } from '@mui/joy';
import { User } from '@/interfaces'; // Asegúrate de que la interfaz User esté correctamente importada

// Interfaz de props para UserAssignmentSelect
interface UserAssignmentSelectProps {
  users: User[];
  values: string[]; // Los IDs de usuario asignados
  onChange: (value: string[]) => void; // Función para manejar el cambio
  suggestedUser?: User | null; // ✅ AÑADIDO: Prop para el usuario sugerido
  fetchingSuggestion: boolean; // ✅ AÑADIDO: Prop para el estado de carga de la sugerencia
  touched: boolean | undefined;
  error: string | undefined; // Ahora es siempre un string o undefined
}

export const UserAssignmentSelect: React.FC<UserAssignmentSelectProps> = ({
  users,
  values,
  onChange,
  suggestedUser, // Usar el prop
  fetchingSuggestion, // Usar el prop
  touched,
  error,
}) => {
  return (
    <div>
      <Typography level="body-sm" sx={{ mb: 0.5 }}>Asignar a:</Typography>
      <Select
        name="assignedUserIds"
        multiple
        value={values}
        key={values.join(',')} // Forzar re-renderizado cuando los valores cambian
        onChange={(_, val) => onChange(val as string[])} // Asegurarse de que val sea string[]
        placeholder={fetchingSuggestion ? "Buscando sugerencia..." : "Asignar usuarios (opcional, automático si no se selecciona)"}
        disabled={fetchingSuggestion}
        renderValue={(selected) => (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {selected.map((selectedId) => {
              // ✅ CORRECCIÓN: Acceder a selectedId.value para la comparación
              const user = users.find((u) => u.id === selectedId.value);
              return user ? <Chip key={user.id}>{user.name}</Chip> : null;
            })}
          </div>
        )}
      >
        {users.map((user) => (
          <Option key={user.id} value={user.id}>
            {user.name} ({user.email})
            {suggestedUser && suggestedUser.id === user.id && " (Sugerido)"}
          </Option>
        ))}
      </Select>
      {touched && error && (
        <Typography level="body-xs" color="danger">{error}</Typography>
      )}
      {suggestedUser && values.length === 0 && !fetchingSuggestion && (
        <Typography level="body-xs" color="warning" sx={{ mt: 0.5 }}>
          Sugerencia: {suggestedUser.name}
        </Typography>
      )}
    </div>
  );
};
