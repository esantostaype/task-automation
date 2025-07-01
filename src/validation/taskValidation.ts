import * as Yup from 'yup'

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
    .required('Duration is required')
})