// src/validation/taskValidation.ts - assignedUserIds obligatorio

import * as Yup from 'yup'
import { Tier } from '@prisma/client'

export const validationSchema = Yup.object({
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  
  description: Yup.string()
    .max(500, 'Description must be less than 500 characters'),
  
  // ✅ categoryId es requerido solo si NO es nueva categoría
  categoryId: Yup.string().when('isNewCategory', {
    is: false,
    then: (schema) => schema.required('Category is required'),
    otherwise: (schema) => schema.notRequired()
  }),
  
  priority: Yup.string()
    .oneOf(['LOW', 'NORMAL', 'HIGH', 'URGENT'], 'Invalid priority')
    .required('Priority is required'),
  
  brandId: Yup.string()
    .required('Brand is required'),
  
  // ✅ CORRECCIÓN: assignedUserIds OBLIGATORIO
  assignedUserIds: Yup.array()
    .of(Yup.string())
    .min(1, 'You must assign at least one user') // ✅ Mínimo 1 usuario
    .max(5, 'Maximum 5 users can be assigned')
    .required('User assignment is required'),
  
  // ✅ VALIDACIÓN ESTRICTA DE DURACIÓN
  durationDays: Yup.string()
    .test(
      'is-valid-duration',
      'Duration must be a valid number between 0.1 and 30 days',
      (value) => {
        if (!value) return false
        const num = parseFloat(value)
        return !isNaN(num) && num >= 0.1 && num <= 30
      }
    )
    .required('Duration is required'),
  
  // ✅ Campos para nuevas categorías
  isNewCategory: Yup.boolean(),
  
  newCategoryName: Yup.string().when('isNewCategory', {
    is: true,
    then: (schema) => schema
      .required('Category name is required')
      .min(2, 'Category name must be at least 2 characters')
      .max(50, 'Category name must be less than 50 characters')
      .matches(/^[a-zA-Z0-9\s\-_]+$/, 'Category name can only contain letters, numbers, spaces, hyphens and underscores'),
    otherwise: (schema) => schema.notRequired()
  }),
  
  // ✅ VALIDACIÓN ESTRICTA DE TIER
  newCategoryTier: Yup.mixed<Tier>().when('isNewCategory', {
    is: true,
    then: (schema) => schema
      .oneOf(Object.values(Tier), 'Please select a valid tier')
      .required('Tier selection is required for new categories'),
    otherwise: (schema) => schema.notRequired()
  }),

  // ✅ VALIDACIÓN GLOBAL: Asegurar que hay una categoría válida
}).test(
  'category-validation',
  'A valid category is required',
  function(values) {
    const { isNewCategory, categoryId, newCategoryName, newCategoryTier } = values;
    
    if (isNewCategory) {
      // Para nuevas categorías, validar nombre Y tier
      if (!newCategoryName || newCategoryName.trim() === '') {
        return this.createError({
          path: 'newCategoryName',
          message: 'Category name is required for new category'
        });
      }
      
      if (!newCategoryTier) {
        return this.createError({
          path: 'newCategoryTier',
          message: 'Tier selection is required for new category'
        });
      }
      
      return true;
    }
    
    // Para categorías existentes, validar categoryId
    if (!categoryId || categoryId.trim() === '') {
      return this.createError({
        path: 'categoryId',
        message: 'Please select an existing category or create a new one'
      });
    }
    
    return true;
  }
)

// ✅ VALIDACIÓN ADICIONAL: Test específico para tier cuando isNewCategory es true
.test(
  'tier-validation',
  'Tier is required for new categories',
  function(values) {
    const { isNewCategory, newCategoryTier } = values;
    
    if (isNewCategory && !newCategoryTier) {
      return this.createError({
        path: 'newCategoryTier',
        message: 'Please select a tier for the new category'
      });
    }
    
    return true;
  }
)

// ✅ NUEVA VALIDACIÓN: Test específico para asignación de usuarios
.test(
  'user-assignment-validation',
  'User assignment is required',
  function(values) {
    const { assignedUserIds } = values;
    
    if (!assignedUserIds || assignedUserIds.length === 0) {
      return this.createError({
        path: 'assignedUserIds',
        message: 'Please assign at least one user to this task'
      });
    }
    
    return true;
  }
)