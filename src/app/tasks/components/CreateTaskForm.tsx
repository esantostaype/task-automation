/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Formik, Form, useFormikContext } from 'formik'
import { Button, Typography } from '@mui/joy'
import { toast } from 'react-toastify'

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

interface FormikSuggestionLogicProps {
  users: User[]
  setSuggestedAssignment: React.Dispatch<
    React.SetStateAction<{ userId: string; durationDays: number } | null>
  >
  setFetchingSuggestion: React.Dispatch<React.SetStateAction<boolean>>
  resetCategory: boolean
  setResetCategory: React.Dispatch<React.SetStateAction<boolean>>
  // ✅ NUEVOS PROPS PARA CONTROL MANUAL
  userHasManuallyChanged: boolean
  setUserHasManuallyChanged: React.Dispatch<React.SetStateAction<boolean>>
}

const FormikSuggestionLogic: React.FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setFetchingSuggestion,
  resetCategory,
  setResetCategory,
  userHasManuallyChanged,
  setUserHasManuallyChanged,
}) => {
  const { values, setFieldValue } = useFormikContext<FormValues>()

  const { suggestedAssignment, fetchingSuggestion } = useTaskSuggestion(
    values.brandId,
    values.categoryId,
    values.priority
  )

  useEffect(() => {
    if (resetCategory) {
      setFieldValue("categoryId", "")
      setResetCategory(false)
      // ✅ Al resetear categoría, permitir nuevas sugerencias
      setUserHasManuallyChanged(false)
    }
  }, [resetCategory, setFieldValue, setResetCategory, setUserHasManuallyChanged])

  useEffect(() => {
    setFetchingSuggestion(fetchingSuggestion)
    setSuggestedAssignment(suggestedAssignment)

    if (suggestedAssignment) {
      // ✅ Actualizar duración siempre (esto no interfiere con selección manual)
      setFieldValue(
        "durationDays",
        suggestedAssignment.durationDays.toString()
      )
      
      // ✅ SOLO actualizar usuarios si el usuario NO ha hecho cambios manuales
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
    } else if (!fetchingSuggestion && values.brandId && values.categoryId) {
      setFieldValue("durationDays", "")
      // ✅ SOLO limpiar usuarios si NO hay cambios manuales
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
    userHasManuallyChanged, // ✅ Agregar dependencia
  ])

  return null
}

export const CreateTaskForm: React.FC = () => {
  const { types, brands, users, loading: dataLoading } = useTaskData()
  const [loading, setLoading] = useState(false)
  const [selectedKind, setSelectedKind] = useState<"UX/UI" | "Graphic">(
    "UX/UI"
  )
  const [resetCategory, setResetCategory] = useState(false)

  const [suggestedAssignment, setSuggestedAssignment] = useState<{
    userId: string
    durationDays: number
  } | null>(null)
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false)

  // ✅ NUEVO ESTADO: Rastrear si el usuario ha hecho cambios manuales
  const [userHasManuallyChanged, setUserHasManuallyChanged] = useState(false)

  const suggestedUser = suggestedAssignment
    ? users.find((u) => u.id === suggestedAssignment.userId)
    : null

  useSocket()

  useEffect(() => {
    setResetCategory(true)
    // ✅ Al cambiar el tipo de tarea, resetear el estado manual
    setUserHasManuallyChanged(false)
  }, [selectedKind])

  const filteredTypes = types.filter((type) => {
    const typeKind = getTypeKind(type.name)
    return typeKind === selectedKind
  })

  const initialValues: FormValues = {
    name: "Task 1",
    description: "",
    categoryId: "",
    priority: "NORMAL",
    brandId: "",
    assignedUserIds: [],
    durationDays: "",
  }

  const handleSubmit = async (values: FormValues) => {
    try {
      const selectedType = filteredTypes.find((type) =>
        type.categories.some((cat) => cat.id === Number(values.categoryId))
      )

      if (!selectedType) {
        toast.error(
          "No se pudo encontrar el tipo de tarea para la categoría seleccionada"
        )
        return
      }

      const finalDurationDays = parseFloat(values.durationDays as string)

      if (finalDurationDays <= 0) {
        toast.error("La duración de la tarea debe ser mayor a cero.")
        return
      }

      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        typeId: selectedType.id,
        categoryId: Number(values.categoryId),
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
        <TaskCreatedToastContent assignedUserNames={ assignedUserNames } startDate={ startDate } endDate={ endDate } />
      )

      // ✅ RESETEAR ESTADO MANUAL DESPUÉS DE CREAR TAREA
      setUserHasManuallyChanged(false)

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

  // ✅ NUEVA FUNCIÓN: Manejar cambios manuales en la selección de usuarios
  const handleUserSelectionChange = (selectedUserIds: string[]) => {
    console.log('👤 Usuario cambió la selección manualmente:', selectedUserIds)
    setUserHasManuallyChanged(true)
    return selectedUserIds
  }

  // ✅ NUEVA FUNCIÓN: Aplicar sugerencia automáticamente (botón/acción)
  const applySuggestion = () => {
    if (suggestedAssignment) {
      console.log('🤖 Aplicando sugerencia manualmente:', suggestedAssignment.userId)
      setUserHasManuallyChanged(false) // Permitir futuras sugerencias automáticas
    }
  }

  return (
    <>
      <SpinnerCreatingTask isActive={ loading } />
      <SpinnerSearching isActive={ fetchingSuggestion } />
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ values, errors, touched, setFieldValue }) => {
          const allCategories = filteredTypes.flatMap((type) =>
            type.categories.map((cat) => ({
              ...cat,
              typeName: type.name,
            }))
          )
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
              />
              <TaskKindSwitch
                selectedKind={selectedKind}
                onKindChange={(kind) => {
                  setSelectedKind(kind)
                  setTimeout(() => {
                    setFieldValue("categoryId", "")
                    setFieldValue("durationDays", "")
                    setFieldValue("assignedUserIds", [])
                    setSuggestedAssignment(null)
                    setUserHasManuallyChanged(false) // ✅ Resetear estado manual
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
                    setUserHasManuallyChanged(false) // ✅ Resetear estado manual
                  }, 0)
                }}
                touched={touched.brandId}
                error={errors.brandId}
                loading={dataLoading}
              />

              <CategorySelect
                categories={allCategories}
                value={values.categoryId}
                onChange={(value) => {
                  setFieldValue("categoryId", value)
                  setUserHasManuallyChanged(false) // ✅ Nueva categoría = permitir sugerencias
                }}
                onCategoryChange={() => {
                  setTimeout(() => {
                    setFieldValue("durationDays", "")
                    setFieldValue("assignedUserIds", [])
                    setSuggestedAssignment(null)
                    setUserHasManuallyChanged(false) // ✅ Resetear estado manual
                  }, 0)
                }}
                touched={touched.categoryId}
                error={errors.categoryId}
                loading={dataLoading}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => {
                  setFieldValue("priority", value)
                  setUserHasManuallyChanged(false) // ✅ Nueva prioridad = permitir sugerencias
                }}
                touched={touched.priority}
                error={errors.priority}
              />

              <DurationField
                fetchingSuggestion={fetchingSuggestion}
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
                suggestedUser={suggestedUser}
                fetchingSuggestion={fetchingSuggestion}
                touched={touched.assignedUserIds}
                error={
                  Array.isArray(errors.assignedUserIds)
                    ? errors.assignedUserIds.join(", ")
                    : errors.assignedUserIds
                }
                loading={dataLoading}
                // ✅ NUEVAS PROPS
                userHasManuallyChanged={userHasManuallyChanged}
                onApplySuggestion={applySuggestion}
              />

              <Button
                type="submit"
                fullWidth
                disabled={loading || (brands.length === 0 && !dataLoading) || fetchingSuggestion}
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