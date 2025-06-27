import * as Yup from 'yup'

export const validationSchema = Yup.object({
  name: Yup.string().required('El nombre es requerido'),
  description: Yup.string(),
  categoryId: Yup.string().required('Categoría requerida'),
  priority: Yup.string().required('Prioridad requerida'),
  brandId: Yup.string().required('Brand requerido'),
  assignedUserIds: Yup.array().of(Yup.string()),
  durationDays: Yup.string()
    .test('is-valid-number', 'La duración debe ser un número válido mayor a 0.1', (value) => {
      if (!value) return false;
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0.1;
    })
    .required('La duración es requerida'),
})