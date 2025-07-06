/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/useCategoryHybrid.ts
import { useState, useCallback, useMemo } from 'react'
import { TaskCategory } from '@/interfaces'

interface CategoryOption {
  label: string
  value: string
  isExisting: boolean
  category?: TaskCategory & { typeName: string }
}

interface UseCategoryHybridProps {
  categories: (TaskCategory & { typeName: string })[]
  currentValue: string | null
  onChange: (value: string | null, isNew?: boolean, newCategoryName?: string) => void
  onCategoryChange: () => void
}

export const useCategoryHybrid = ({
  categories,
  currentValue,
  onChange,
  onCategoryChange
}: UseCategoryHybridProps) => {
  const [inputValue, setInputValue] = useState('')

  // Crear opciones del autocomplete
  const autocompleteOptions = useMemo((): CategoryOption[] => {
    return categories.map(cat => ({
      label: cat.name,
      value: cat.id.toString(),
      isExisting: true,
      category: cat
    }))
  }, [categories])

  // Encontrar la opción seleccionada actual
  const selectedOption = useMemo((): CategoryOption | null => {
    if (!currentValue) return null
    
    // Buscar por ID (categoría existente)
    const existingCategory = categories.find(cat => cat.id.toString() === currentValue)
    if (existingCategory) {
      return {
        label: existingCategory.name,
        value: existingCategory.id.toString(),
        isExisting: true,
        category: existingCategory
      }
    }
    
    // Si no se encuentra por ID, es una nueva categoría (valor es el nombre)
    return {
      label: currentValue,
      value: currentValue,
      isExisting: false
    }
  }, [currentValue, categories])

  // Determinar si se está creando una nueva categoría
  const isCreatingNew = useMemo(() => {
    if (!currentValue) return false
    
    // Si no encuentra una categoría existente con ese ID, es nueva
    const existingCategory = categories.find(cat => cat.id.toString() === currentValue)
    return !existingCategory
  }, [currentValue, categories])

  // Manejar cambios en el autocomplete
  const handleAutocompleteChange = useCallback((newValue: any) => {
    if (!newValue) {
      onChange(null)
      onCategoryChange()
      return
    }

    // Si es string, es una nueva categoría
    if (typeof newValue === 'string') {
      const trimmedValue = newValue.trim()
      if (trimmedValue) {
        onChange(trimmedValue, true, trimmedValue)
        onCategoryChange()
      }
      return
    }

    // Si es objeto con isExisting, es categoría existente
    if (newValue.isExisting) {
      onChange(newValue.value, false)
      onCategoryChange()
    } else {
      // Nueva categoría creada desde el autocomplete
      const trimmedLabel = newValue.label.trim()
      if (trimmedLabel) {
        onChange(trimmedLabel, true, trimmedLabel)
        onCategoryChange()
      }
    }
  }, [onChange, onCategoryChange])

  // Filtrar opciones basado en el input
  const getFilteredOptions = useCallback((inputValue: string): CategoryOption[] => {
    if (!inputValue) return autocompleteOptions

    const filtered = autocompleteOptions.filter(option =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    )

    // Si no hay coincidencias exactas y hay input, sugerir crear nueva
    const hasExactMatch = filtered.some(option => 
      option.label.toLowerCase() === inputValue.toLowerCase()
    )

    if (!hasExactMatch && inputValue.trim()) {
      filtered.unshift({
        label: `Create "${inputValue.trim()}"`,
        value: inputValue.trim(),
        isExisting: false
      })
    }

    return filtered
  }, [autocompleteOptions])

  return {
    inputValue,
    setInputValue,
    autocompleteOptions,
    selectedOption,
    isCreatingNew,
    handleAutocompleteChange,
    getFilteredOptions
  }
}