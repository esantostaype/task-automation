/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  Autocomplete,
  FormLabel,
  RadioGroup,
  Radio,
  Box,
} from "@mui/joy";
import { TaskCategory } from "@/interfaces";
import { HugeiconsIcon } from "@hugeicons/react";
import { LabelImportantIcon, Layers01Icon } from "@hugeicons/core-free-icons";
import { TextFieldError } from "@/components";
import { Tier } from "@prisma/client";

interface CategorySelectProps {
  categories: (TaskCategory & { typeName: string })[];
  value: string | null; // Puede ser ID de categoría existente o nombre de nueva categoría
  onChange: (
    value: string | null,
    isNew?: boolean,
    newCategoryName?: string
  ) => void;
  onCategoryChange: () => void;
  touched?: boolean;
  error?: string;
  loading?: boolean;
  // Nuevos props para crear categoría
  selectedTier: Tier | null;
  onTierChange: (tier: Tier | null) => void;
  showTierSelection?: boolean; // Se muestra cuando se va a crear una nueva categoría
}

export const CategorySelect: React.FC<CategorySelectProps> = ({
  categories,
  value,
  onChange,
  onCategoryChange,
  touched,
  error,
  loading = false,
  selectedTier,
  onTierChange,
  showTierSelection = false,
}) => {
  // Determinar si la categoría actual es nueva
  const isNewCategory = value
    ? !categories.find((cat) => cat.id.toString() === value)
    : false;

  // Crear opciones del autocomplete que incluyan una opción para crear nueva
  const autocompleteOptions = React.useMemo(() => {
    const existingOptions = categories.map((cat) => ({
      label: cat.name,
      value: cat.id.toString(),
      isExisting: true,
      category: cat,
    }));

    return existingOptions;
  }, [categories]);

  // Encontrar la opción seleccionada
  const selectedOption = React.useMemo(() => {
    if (!value) return null;

    const existingCategory = categories.find(
      (cat) => cat.id.toString() === value
    );
    if (existingCategory) {
      return {
        label: existingCategory.name,
        value: existingCategory.id.toString(),
        isExisting: true,
        category: existingCategory,
      };
    }

    // Nueva categoría
    return {
      label: value,
      value: value,
      isExisting: false,
      category: null,
    };
  }, [value, categories]);

  const handleAutocompleteChange = (event: any, newValue: any) => {
    if (!newValue) {
      onChange(null);
      onCategoryChange();
      return;
    }

    // Si es string (texto libre), es nueva categoría
    if (typeof newValue === "string") {
      const trimmedValue = newValue.trim();
      if (trimmedValue) {
        onChange(trimmedValue, true, trimmedValue);
        onCategoryChange();
      }
      return;
    }

    // Si es objeto de categoría existente
    if (newValue.isExisting) {
      onChange(newValue.value, false);
      onCategoryChange();
    } else {
      // Nueva categoría desde autocomplete
      const trimmedLabel = newValue.label.trim();
      if (trimmedLabel) {
        onChange(trimmedLabel, true, trimmedLabel);
        onCategoryChange();
      }
    }
  };

  const getPlaceholder = () => {
    if (loading) return "Loading categories...";
    return "Search existing or type new category name...";
  };

  return (
    <div>
      <FormLabel>
        <HugeiconsIcon icon={LabelImportantIcon} size={20} strokeWidth={1.5} />
        Category
        {isNewCategory && (
          <span
            style={{
              color: "var(--joy-palette-warning-500)",
              marginLeft: "4px",
            }}
          >
            (New)
          </span>
        )}
      </FormLabel>

      <Autocomplete
        placeholder={getPlaceholder()}
        value={selectedOption}
        onChange={handleAutocompleteChange}
        options={autocompleteOptions}
        freeSolo
        clearOnBlur={false}
        selectOnFocus
        handleHomeEndKeys
        disabled={loading}
        getOptionLabel={(option) => {
          if (typeof option === "string") return option;
          return option.label || "";
        }}
        filterOptions={(options, { inputValue }) => {
          const filtered = options.filter((option) =>
            option.label.toLowerCase().includes(inputValue.toLowerCase())
          );
          return filtered;
        }}
        renderOption={(props, option, { selected }) => (
          <li
            {...props}
            className={`px-3 py-2 cursor-pointer transition-colors ${selected ? "bg-[var(--soft-bg-success)]" : ""} hover:bg-[var(--soft-bg-hover)] active:bg-[var(--soft-bg-active)]`}
          >
            {option.label}
          </li>
        )}
        noOptionsText={loading ? "Loading..." : "Type to create a new category"}
      />

      {/* Mostrar selección de Tier cuando se va a crear nueva categoría */}
      {showTierSelection && (
        <Box sx={{ mt: 2 }}>
          <FormLabel sx={{ mt: 2 }}>
            <HugeiconsIcon icon={Layers01Icon} size={20} strokeWidth={1.5} />
            New Category Tier
          </FormLabel>
          <RadioGroup
            orientation="horizontal"
            value={selectedTier}
            onChange={(event) => onTierChange(event.target.value as Tier)}
            sx={{ mb: 2 }}
          >
            {Object.values(Tier).map((tierValue) => (
              <Radio
                key={tierValue}
                value={tierValue}
                label={tierValue}
                size="sm"
                sx={{ display: 'flex', alignItems: 'center' }}
              />
            ))}
          </RadioGroup>
        </Box>
      )}

      {touched && error && <TextFieldError label={error} />}
    </div>
  );
};
