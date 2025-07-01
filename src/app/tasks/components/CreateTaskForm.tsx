/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Formik, Form, useFormikContext } from 'formik'
import { Button, Typography } from '@mui/joy'
import { toast } from 'react-toastify'

import { SpinnerCreatingTask, SpinnerSearching } from '@/components'
import { TaskKindSwitch } from './TaskKindSwitch'
import { TaskNameField } from './TaskNameField'
import { BrandSelect } from './BrandSelect'
import { CategorySelect } from './CategorySelect'
import { PrioritySelect } from './PrioritySelect'
import { DurationField } from './DurationField'
import { UserAssignmentSelect } from './UserAssignmentSelect'

import { useTaskData } from '@/hooks/useTaskData'
import { useSocket } from '@/hooks/useSocket'
import { useTaskSuggestion } from '@/hooks/useTaskSuggestion'
import { getTypeKind } from '@/utils/taskUtils'
import { validationSchema } from '@/validation/taskValidation'
import { FormValues, User } from '@/interfaces'
import { TaskCreatedToastContent } from './TaskCreatedToastContent'

interface FormikSuggestionLogicProps {
  users: User[]
  setSuggestedAssignment: React.Dispatch<
    React.SetStateAction<{ userId: string; durationDays: number } | null>
  >
  setFetchingSuggestion: React.Dispatch<React.SetStateAction<boolean>>
  resetCategory: boolean
  setResetCategory: React.Dispatch<React.SetStateAction<boolean>>
}

const FormikSuggestionLogic: React.FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setFetchingSuggestion,
  resetCategory,
  setResetCategory,
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
    }
  }, [resetCategory, setFieldValue, setResetCategory])

  useEffect(() => {
    setFetchingSuggestion(fetchingSuggestion)
    setSuggestedAssignment(suggestedAssignment)

    if (suggestedAssignment) {
      setFieldValue(
        "durationDays",
        suggestedAssignment.durationDays.toString()
      )
      if (
        values.assignedUserIds.length === 0 ||
        values.assignedUserIds[0] !== suggestedAssignment.userId
      ) {
        setFieldValue("assignedUserIds", [suggestedAssignment.userId])
      }
    } else if (!fetchingSuggestion && values.brandId && values.categoryId) {
      setFieldValue("durationDays", "")
      if (values.assignedUserIds.length === 0) {
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

  const suggestedUser = suggestedAssignment
    ? users.find((u) => u.id === suggestedAssignment.userId)
    : null

  useSocket()

  useEffect(() => {
    setResetCategory(true)
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
                  }, 0)
                }}
                touched={touched.brandId}
                error={errors.brandId}
                loading={dataLoading}
              />

              <CategorySelect
                categories={allCategories}
                value={values.categoryId}
                onChange={(value) => setFieldValue("categoryId", value)}
                onCategoryChange={() => {
                  setTimeout(() => {
                    setFieldValue("durationDays", "")
                    setFieldValue("assignedUserIds", [])
                    setSuggestedAssignment(null)
                  }, 0)
                }}
                touched={touched.categoryId}
                error={errors.categoryId}
                loading={dataLoading}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => setFieldValue("priority", value)}
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
                onChange={(value) => setFieldValue("assignedUserIds", value)}
                suggestedUser={suggestedUser}
                fetchingSuggestion={fetchingSuggestion}
                touched={touched.assignedUserIds}
                error={
                  Array.isArray(errors.assignedUserIds)
                    ? errors.assignedUserIds.join(", ")
                    : errors.assignedUserIds
                }
                loading={dataLoading}
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