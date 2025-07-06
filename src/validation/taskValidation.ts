import * as Yup from 'yup'
import { Tier } from '@prisma/client'

export const validationSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  description: Yup.string(),
  categoryId: Yup.string().required('Category is required'),
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
  // Nuevos campos para crear categoría
  isNewCategory: Yup.boolean(),
  newCategoryName: Yup.string().when('isNewCategory', {
    is: true,
    then: (schema) => schema.required('Category name is required'),
    otherwise: (schema) => schema.notRequired()
  }),
  newCategoryTier: Yup.mixed<Tier>().when('isNewCategory', {
    is: true,
    then: (schema) => schema.oneOf(Object.values(Tier)).required('Tier selection is required'),
    otherwise: (schema) => schema.notRequired()
  })
})