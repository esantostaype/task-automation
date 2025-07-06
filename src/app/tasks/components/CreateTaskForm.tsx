/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Formik, Form, useFormikContext } from 'formik'
import { Button, Typography } from '@mui/joy'
import { toast } from 'react-toastify'
import { Tier } from '@prisma/client'

import { SpinnerCreatingTask, SpinnerSearching } from '@/components'
import {
  TaskKindSwitch,
  TaskNameField,
  BrandSelect,
  CategorySelect,
  PrioritySelect,
  DurationField,
  UserAssignmentSelect,
  TaskCreatedToastContent
} from './'

import { useSocket, useTaskData, useTaskSuggestion } from '@/hooks'
import { getTypeKind } from '@/utils'
import { validationSchema } from '@/validation/taskValidation'
import { FormValues, User } from '@/interfaces'

interface ExtendedFormValues extends FormValues {
  newCategoryTier: Tier | null
  isNewCategory: boolean
  newCategoryName: string
}

interface FormikSuggestionLogicProps {
  users: User[]
  setSuggestedAssignment: React.Dispatch<
    React.SetStateAction<{ userId: string; durationDays: number } | null>
  >
  setFetchingSuggestion: React.Dispatch<React.SetStateAction<boolean>>
  resetCategory: boolean
  setResetCategory: React.Dispatch<React.SetStateAction<boolean>>
  userHasManuallyChanged: boolean
  setUserHasManuallyChanged: React.Dispatch<React.SetStateAction<boolean>>
  isNewCategory: boolean
  types: any[]
  selectedKind: "UX/UI" | "Graphic"
  triggerSuggestion: number
  // ✅ NUEVO: Para prevenir sugerencias durante envío
  isSubmitting: boolean
}

const FormikSuggestionLogic: React.FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setFetchingSuggestion,
  resetCategory,
  setResetCategory,
  userHasManuallyChanged,
  setUserHasManuallyChanged,
  isNewCategory,
  types,
  selectedKind,
  triggerSuggestion,
  isSubmitting, // ✅ NUEVO
}) => {
  const { values, setFieldValue } = useFormikContext<ExtendedFormValues>()

  // ✅ Obtener el typeId para nuevas categorías
  const currentTypeId = React.useMemo(() => {
    if (!isNewCategory) return undefined
    
    const filteredTypes = types.filter((type) => {
      const typeKind = getTypeKind(type.name)
      return typeKind === selectedKind
    })
    
    const typeId = filteredTypes.length > 0 ? filteredTypes[0].id : undefined
    
    console.log('🔍 Current type ID for new category:', {
      isNewCategory,
      selectedKind,
      typeId,
      filteredTypes: filteredTypes.map(t => ({ id: t.id, name: t.name }))
    })
    
    return typeId
  }, [isNewCategory, selectedKind])

  // ✅ Usar el hook actualizado con soporte para nuevas categorías
  const { suggestedAssignment, fetchingSuggestion } = useTaskSuggestion(
    isSubmitting ? '' : values.brandId, // ✅ No buscar sugerencias si está enviando
    isSubmitting ? '' : values.categoryId,
    isSubmitting ? '' : values.priority,
    isSubmitting ? false : isNewCategory,
    isSubmitting ? '' : (values.durationDays as string),
    isSubmitting ? undefined : currentTypeId,
    isSubmitting ? 0 : triggerSuggestion // ✅ No triggear si está enviando
  )

  useEffect(() => {
    if (resetCategory) {
      setFieldValue("categoryId", "")
      setFieldValue("isNewCategory", false)
      setFieldValue("newCategoryName", "")
      setFieldValue("newCategoryTier", null)
      setResetCategory(false)
      setUserHasManuallyChanged(false)
    }
  }, [resetCategory, setFieldValue, setResetCategory, setUserHasManuallyChanged])

  // ✅ Efecto para detectar cuando todos los campos están listos para nueva categoría
  useEffect(() => {
    console.log('🔍 Checking if ready for new category suggestion:', {
      isNewCategory: values.isNewCategory,
      brandId: values.brandId,
      priority: values.priority,
      durationDays: values.durationDays,
      newCategoryTier: values.newCategoryTier,
      currentTypeId
    })

    // Si es nueva categoría y tenemos todos los datos necesarios
    if (
      values.isNewCategory && 
      values.brandId && 
      values.priority && 
      values.durationDays && 
      parseFloat(values.durationDays as string) > 0 &&
      values.newCategoryTier &&
      currentTypeId
    ) {
      console.log('✅ All conditions met for new category suggestion, triggering...')
      // Aquí no podemos usar setTriggerSuggestion porque está en el padre
      // En su lugar, el useTaskSuggestion ya debería reaccionar a los cambios
    }
  }, [
    values.isNewCategory,
    values.brandId, 
    values.priority, 
    values.durationDays,
    values.newCategoryTier,
    currentTypeId
  ])

  useEffect(() => {
    // ✅ NO actualizar estado si está enviando
    if (isSubmitting) {
      return
    }

    setFetchingSuggestion(fetchingSuggestion)
    setSuggestedAssignment(suggestedAssignment)

    // ✅ Manejar sugerencias tanto para categorías existentes como nuevas
    if (suggestedAssignment) {
      console.log('🤖 Aplicando sugerencia:', {
        userId: suggestedAssignment.userId,
        durationDays: suggestedAssignment.durationDays,
        isNewCategory
      })

      // Para categorías existentes, actualizar duración solo si no es manual
      if (!isNewCategory) {
        setFieldValue("durationDays", suggestedAssignment.durationDays.toString())
      }
      
      // Asignar usuario si no ha habido cambios manuales
      if (!userHasManuallyChanged) {
        if (
          values.assignedUserIds.length === 0 ||
          values.assignedUserIds[0] !== suggestedAssignment.userId
        ) {
          console.log('🤖 Aplicando sugerencia de usuario:', suggestedAssignment.userId)
          setFieldValue("assignedUserIds", [suggestedAssignment.userId])
        }
      } else {
        console.log('👤 Usuario ha hecho cambios manuales, manteniendo selección actual')
      }
    } else if (!fetchingSuggestion && !isNewCategory && values.brandId && values.categoryId) {
      // Solo limpiar para categorías existentes cuando no hay sugerencia
      setFieldValue("durationDays", "")
      if (!userHasManuallyChanged && values.assignedUserIds.length === 0) {
        setFieldValue("assignedUserIds", [])
      }
    }
  }, [
    suggestedAssignment,
    fetchingSuggestion,
    values.brandId,
    values.categoryId,
    values.durationDays,
    setFieldValue,
    values.assignedUserIds.length,
    setSuggestedAssignment,
    setFetchingSuggestion,
    values.assignedUserIds,
    userHasManuallyChanged,
    isNewCategory,
    isSubmitting, // ✅ Agregar isSubmitting
  ])

  return null
}

export const CreateTaskForm: React.FC = () => {
  const { types, brands, users, loading: dataLoading } = useTaskData()
  const [loading, setLoading] = useState(false)
  const [selectedKind, setSelectedKind] = useState<"UX/UI" | "Graphic">("UX/UI")
  const [resetCategory, setResetCategory] = useState(false)
  
  // ✅ Nuevo estado para trackear si se está escribiendo una nueva categoría
  const [isTypingNewCategory, setIsTypingNewCategory] = useState(false)
  // ✅ Nuevo estado para forzar actualización de sugerencias
  const [triggerSuggestion, setTriggerSuggestion] = useState(0)

  const [suggestedAssignment, setSuggestedAssignment] = useState<{
    userId: string
    durationDays: number
  } | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)
  const [userHasManuallyChanged, setUserHasManuallyChanged] = useState(false)

  const suggestedUser = suggestedAssignment
    ? users.find((u) => u.id === suggestedAssignment.userId)
    : null

  useSocket()

  useEffect(() => {
    setResetCategory(true)
    setUserHasManuallyChanged(false)
    setIsTypingNewCategory(false)
  }, [selectedKind])

  const filteredTypes = types.filter((type) => {
    const typeKind = getTypeKind(type.name)
    return typeKind === selectedKind
  })

  const allCategories = filteredTypes.flatMap((type) =>
    type.categories.map((cat) => ({
      ...cat,
      typeName: type.name,
    }))
  )

  const initialValues: ExtendedFormValues = {
    name: "Task 1",
    description: "",
    categoryId: "",
    priority: "NORMAL",
    brandId: "",
    assignedUserIds: [],
    durationDays: "",
    newCategoryTier: null,
    isNewCategory: false,
    newCategoryName: "",
  }

  const handleSubmit = async (values: ExtendedFormValues) => {
    try {
      let finalCategoryId = values.categoryId
      let finalTypeId: number

      // Si es una nueva categoría, crearla primero
      if (values.isNewCategory) {
        if (!values.newCategoryName.trim()) {
          toast.error("Category name is required for new category")
          return
        }

        if (!values.newCategoryTier) {
          toast.error("Tier selection is required for new category")
          return
        }

        const finalDurationDays = parseFloat(values.durationDays as string)
        if (finalDurationDays <= 0) {
          toast.error("Duration must be greater than zero for new category")
          return
        }

        // Encontrar el tipo correspondiente al selectedKind
        const selectedType = filteredTypes[0]
        if (!selectedType) {
          toast.error("No type found for the selected kind")
          return
        }

        finalTypeId = selectedType.id

        // Crear la nueva categoría
        console.log('🆕 Creando nueva categoría:', {
          name: values.newCategoryName.trim(),
          duration: finalDurationDays,
          tier: values.newCategoryTier,
          typeId: finalTypeId
        })

        const categoryResponse = await axios.post('/api/categories', {
          name: values.newCategoryName.trim(),
          duration: finalDurationDays,
          tier: values.newCategoryTier,
          typeId: finalTypeId
        })

        finalCategoryId = categoryResponse.data.id.toString()
        console.log('✅ Nueva categoría creada con ID:', finalCategoryId)
      } else {
        // Categoría existente
        const selectedType = filteredTypes.find((type) =>
          type.categories.some((cat) => cat.id === Number(values.categoryId))
        )

        if (!selectedType) {
          toast.error("No se pudo encontrar el tipo de tarea para la categoría seleccionada")
          return
        }

        finalTypeId = selectedType.id
      }

      const finalDurationDays = parseFloat(values.durationDays as string)

      if (finalDurationDays <= 0) {
        toast.error("La duración de la tarea debe ser mayor a cero.")
        return
      }

      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        typeId: finalTypeId,
        categoryId: Number(finalCategoryId),
        priority: values.priority,
        brandId: values.brandId,
        assignedUserIds:
          values.assignedUserIds.length > 0
            ? values.assignedUserIds
            : undefined,
        durationDays: finalDurationDays,
      }

      setLoading(true)

      const taskResponse = await axios.post("/api/tasks", payload)
      const createdTask = taskResponse.data

      setLoading(false)

      const assignedUserNames =
        createdTask.assignees?.map((a: any) => a.user.name).join(", ") ?? "somebody"

      const startDate = new Date(createdTask.startDate).toLocaleDateString(
        "es-PE",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
      const endDate = new Date(createdTask.deadline).toLocaleDateString(
        "es-PE",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )

      toast.success(
        <TaskCreatedToastContent assignedUserNames={assignedUserNames} startDate={startDate} endDate={endDate} />
      )

      setUserHasManuallyChanged(false)
      setIsTypingNewCategory(false)

    } catch (error: unknown) {
      setLoading(false)
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error)
      } else if (axios.isAxiosError(error) && error.response?.data?.details) {
        toast.error(`Error: ${error.response.data.details}`)
      } else {
        toast.error("Error inesperado al crear la tarea")
      }
    }
  }

  const handleUserSelectionChange = (selectedUserIds: string[]) => {
    console.log('👤 Usuario cambió la selección manualmente:', selectedUserIds)
    setUserHasManuallyChanged(true)
    return selectedUserIds
  }

  const applySuggestion = () => {
    if (suggestedAssignment) {
      console.log('🤖 Aplicando sugerencia manualmente:', suggestedAssignment.userId)
      setUserHasManuallyChanged(false)
    }
  }

  // ✅ Función para manejar cuando se completa la duración
  const handleDurationComplete = (duration: string) => {
    console.log('⏰ Duration completed, triggering suggestion:', duration)
    setTriggerSuggestion(prev => prev + 1)
  }

  return (
    <>
      <SpinnerCreatingTask isActive={loading} />
      <SpinnerSearching isActive={fetchingSuggestion} />
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting }) => {
          const handleCategoryChange = (value: string | null, isNew?: boolean, newCategoryName?: string) => {
            console.log('📋 Category change:', { value, isNew, newCategoryName })
            
            setFieldValue("categoryId", value || "")
            setFieldValue("isNewCategory", isNew || false)
            setFieldValue("newCategoryName", newCategoryName || "")
            
            if (isNew) {
              // Si es nueva categoría, limpiar duración para que sea manual
              setFieldValue("durationDays", "")
              setFieldValue("assignedUserIds", [])
              setSuggestedAssignment(null)
              
              // ✅ NUEVO: Trigger sugerencia inmediatamente si ya hay duración
              if (values.durationDays && parseFloat(values.durationDays as string) > 0) {
                console.log('🔄 Triggering suggestion for new category with existing duration')
                setTriggerSuggestion(prev => prev + 1)
              }
            }
            
            setUserHasManuallyChanged(false)
          }

          return (
            <Form className="flex flex-col gap-4">
              <FormikSuggestionLogic
                users={users}
                setSuggestedAssignment={setSuggestedAssignment}
                setFetchingSuggestion={setFetchingSuggestion}
                resetCategory={resetCategory}
                setResetCategory={setResetCategory}
                userHasManuallyChanged={userHasManuallyChanged}
                setUserHasManuallyChanged={setUserHasManuallyChanged}
                isNewCategory={values.isNewCategory}
                types={types}
                selectedKind={selectedKind}
                triggerSuggestion={triggerSuggestion}
                isSubmitting={isSubmitting} // ✅ Pasar isSubmitting
              />
              
              <TaskKindSwitch
                selectedKind={selectedKind}
                onKindChange={(kind) => {
                  setSelectedKind(kind)
                  setTimeout(() => {
                    setFieldValue("categoryId", "")
                    setFieldValue("durationDays", "")
                    setFieldValue("assignedUserIds", [])
                    setFieldValue("isNewCategory", false)
                    setFieldValue("newCategoryName", "")
                    setFieldValue("newCategoryTier", null)
                    setSuggestedAssignment(null)
                    setUserHasManuallyChanged(false)
                    setIsTypingNewCategory(false)
                  }, 0)
                }}
              />
              
              <TaskNameField touched={touched.name} error={errors.name} />

              <BrandSelect
                brands={brands}
                value={values.brandId}
                onChange={(value) => {
                  setFieldValue("brandId", value)
                  setTimeout(() => {
                    setFieldValue("durationDays", "")
                    setFieldValue("assignedUserIds", [])
                    setSuggestedAssignment(null)
                    setUserHasManuallyChanged(false)
                  }, 0)
                }}
                touched={touched.brandId}
                error={errors.brandId}
                loading={dataLoading}
              />

              <CategorySelect
                categories={allCategories}
                value={values.categoryId || null}
                onChange={handleCategoryChange}
                onCategoryChange={() => {
                  setTimeout(() => {
                    if (!values.isNewCategory) {
                      setFieldValue("durationDays", "")
                      setFieldValue("assignedUserIds", [])
                      setSuggestedAssignment(null)
                    }
                    setUserHasManuallyChanged(false)
                  }, 0)
                }}
                touched={touched.categoryId}
                error={errors.categoryId}
                loading={dataLoading}
                selectedTier={values.newCategoryTier}
                onTierChange={(tier) => setFieldValue("newCategoryTier", tier)}
                showTierSelection={values.isNewCategory}
                onTypingNewCategory={setIsTypingNewCategory}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => {
                  setFieldValue("priority", value)
                  if (!values.isNewCategory) {
                    setUserHasManuallyChanged(false)
                  }
                }}
                touched={touched.priority}
                error={errors.priority}
              />

              <DurationField
                fetchingSuggestion={fetchingSuggestion && !values.isNewCategory}
                touched={touched.durationDays}
                error={errors.durationDays}
                isTypingNewCategory={isTypingNewCategory}
                onDurationComplete={handleDurationComplete}
              />

              <UserAssignmentSelect
                users={users}
                values={values.assignedUserIds}
                onChange={(selectedUserIds) => {
                  const newSelection = handleUserSelectionChange(selectedUserIds)
                  setFieldValue("assignedUserIds", newSelection)
                }}
                suggestedUser={suggestedUser}
                fetchingSuggestion={fetchingSuggestion}
                touched={touched.assignedUserIds}
                error={
                  Array.isArray(errors.assignedUserIds)
                    ? errors.assignedUserIds.join(", ")
                    : errors.assignedUserIds
                }
                loading={dataLoading}
                userHasManuallyChanged={userHasManuallyChanged}
                onApplySuggestion={applySuggestion}
              />

              <Button
                type="submit"
                fullWidth
                disabled={
                  loading || 
                  isSubmitting || // ✅ Deshabilitar durante envío
                  (brands.length === 0 && !dataLoading) || 
                  (fetchingSuggestion && !values.isNewCategory)
                }
                size="lg"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'} {/* ✅ Mostrar estado */}
              </Button>

              {brands.length === 0 && !dataLoading && (
                <Typography level="body-xs" color="warning" textAlign="center">
                  No hay brands activos disponibles
                </Typography>
              )}
            </Form>
          )
        }}
      </Formik>
    </>
  )
}