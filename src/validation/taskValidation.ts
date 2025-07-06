import * as Yup from 'yup'
import { Tier } from '@prisma/client'

export const validationSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  description: Yup.string(),
  
  // ✅ VALIDACIÓN MEJORADA: categoryId es requerido solo si NO es nueva categoría
  categoryId: Yup.string().when('isNewCategory', {
    is: false, // Cuando NO es nueva categoría
    then: (schema) => schema.required('Category is required'),
    otherwise: (schema) => schema.notRequired() // Para nuevas categorías, no es requerido
  }),
  
  priority: Yup.string().required('Priority is required'),
  brandId: Yup.string().required('Brand is required'),
  assignedUserIds: Yup.array()
    .of(Yup.string())
    .min(1, 'You must select at least one assigned user'),
  durationDays: Yup.string()
    .test(
      'is-valid-number',
      'Duration must be a valid number greater than 0.1',
      (value) => {
        if (!value) return false
        const num = parseFloat(value)
        return !isNaN(num) && num >= 0.1
      }
    )
    .required('Duration is required'),
  
  // ✅ CAMPOS PARA NUEVAS CATEGORÍAS
  isNewCategory: Yup.boolean(),
  
  // ✅ VALIDACIÓN MEJORADA: newCategoryName es requerido cuando es nueva categoría
  newCategoryName: Yup.string().when('isNewCategory', {
    is: true,
    then: (schema) => schema.required('Category name is required'),
    otherwise: (schema) => schema.notRequired()
  }),
  
  // ✅ VALIDACIÓN MEJORADA: newCategoryTier es requerido cuando es nueva categoría
  newCategoryTier: Yup.mixed<Tier>().when('isNewCategory', {
    is: true,
    then: (schema) => schema.oneOf(Object.values(Tier)).required('Tier selection is required'),
    otherwise: (schema) => schema.notRequired()
  }),

  // ✅ VALIDACIÓN ADICIONAL: Asegurar que haya al menos una categoría válida
}).test(
  'category-validation',
  'A valid category is required',
  function(values) {
    const { isNewCategory, categoryId, newCategoryName } = values;
    
    // Si es nueva categoría, debe tener newCategoryName
    if (isNewCategory) {
      if (!newCategoryName || newCategoryName.trim() === '') {
        return this.createError({
          path: 'newCategoryName',
          message: 'Category name is required for new category'
        });
      }
      return true;
    }
    
    // Si NO es nueva categoría, debe tener categoryId
    if (!categoryId || categoryId.trim() === '') {
      return this.createError({
        path: 'categoryId',
        message: 'Please select an existing category or create a new one'
      });
    }
    
    return true;
  }
)