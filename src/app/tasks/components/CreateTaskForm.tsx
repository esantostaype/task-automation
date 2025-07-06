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
}

const FormikSuggestionLogic: React.FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setFetchingSuggestion,
  resetCategory,
  setResetCategory,
  userHasManuallyChanged,
  setUserHasManuallyChanged,
  isNewCategory,
}) => {
  const { values, setFieldValue } = useFormikContext<ExtendedFormValues>()

  // Solo hacer sugerencias si NO es una nueva categoría
  const shouldFetchSuggestion = !isNewCategory && values.brandId && values.categoryId && values.priority

  const { suggestedAssignment, fetchingSuggestion } = useTaskSuggestion(
    shouldFetchSuggestion ? values.brandId : '',
    shouldFetchSuggestion ? values.categoryId : '',
    shouldFetchSuggestion ? values.priority : ''
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

  useEffect(() => {
    setFetchingSuggestion(fetchingSuggestion)
    setSuggestedAssignment(suggestedAssignment)

    if (suggestedAssignment && !isNewCategory) {
      setFieldValue("durationDays", suggestedAssignment.durationDays.toString())
      
      if (!userHasManuallyChanged) {
        if (
          values.assignedUserIds.length === 0 ||
          values.assignedUserIds[0] !== suggestedAssignment.userId
        ) {
          console.log('🤖 Aplicando sugerencia automática:', suggestedAssignment.userId)
          setFieldValue("assignedUserIds", [suggestedAssignment.userId])
        }
      } else {
        console.log('👤 Usuario ha hecho cambios manuales, manteniendo selección actual')
      }
    } else if (!fetchingSuggestion && !isNewCategory && values.brandId && values.categoryId) {
      // Solo limpiar duración si NO es nueva categoría
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
    setFieldValue,
    values.assignedUserIds.length,
    setSuggestedAssignment,
    setFetchingSuggestion,
    values.assignedUserIds,
    userHasManuallyChanged,
    isNewCategory,
  ])

  return null
}

export const CreateTaskForm: React.FC = () => {
  const { types, brands, users, loading: dataLoading } = useTaskData()
  const [loading, setLoading] = useState(false)
  const [selectedKind, setSelectedKind] = useState<"UX/UI" | "Graphic">("UX/UI")
  const [resetCategory, setResetCategory] = useState(false)
  const [categoryInputValue, setCategoryInputValue] = useState('') // Mantener el texto escrito

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
    // NO limpiar categoryInputValue aquí para mantener lo escrito
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
      setCategoryInputValue('') // Limpiar el texto después de crear la tarea

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
        {({ values, errors, touched, setFieldValue }) => {
          const handleCategoryChange = (value: string | null, isNew?: boolean, newCategoryName?: string) => {
            setFieldValue("categoryId", value || "")
            setFieldValue("isNewCategory", isNew || false)
            setFieldValue("newCategoryName", newCategoryName || "")
            
            if (isNew) {
              // Si es nueva categoría, limpiar duración para que sea manual
              setFieldValue("durationDays", "")
              setFieldValue("assignedUserIds", [])
              setSuggestedAssignment(null)
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
              />

              <UserAssignmentSelect
                users={users}
                values={values.assignedUserIds}
                onChange={(selectedUserIds) => {
                  const newSelection = handleUserSelectionChange(selectedUserIds)
                  setFieldValue("assignedUserIds", newSelection)
                }}
                suggestedUser={!values.isNewCategory ? suggestedUser : null}
                fetchingSuggestion={fetchingSuggestion && !values.isNewCategory}
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
                disabled={loading || (brands.length === 0 && !dataLoading) || (fetchingSuggestion && !values.isNewCategory)}
                size="lg"
              >
                Create Task
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