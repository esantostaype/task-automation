// src/app/tasks/components/CreateTaskForm.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Formik, Form, useFormikContext } from "formik";
import { Button, Typography } from "@mui/joy";
import { toast } from "react-toastify";
import { Tier } from "@prisma/client";

import { SpinnerCreatingTask, SpinnerSearching } from "@/components";
import {
  TaskKindSwitch,
  TaskNameField,
  BrandSelect,
  CategorySelect,
  PrioritySelect,
  DurationField,
  UserAssignmentSelect,
  TaskCreatedToastContent,
} from "./";

import { useSocket, useTaskData, useTaskSuggestion } from "@/hooks";
import { getTypeKind } from "@/utils";
import { validationSchema } from "@/validation/taskValidation";
import { FormValues, User, TaskType } from "@/interfaces";

interface ExtendedFormValues extends FormValues {
  newCategoryTier: Tier | null;
  isNewCategory: boolean;
  newCategoryName: string;
}

interface FormikSuggestionLogicProps {
  users: User[];
  setSuggestedAssignment: React.Dispatch<
    React.SetStateAction<{ userId: string; durationDays: number } | null>
  >;
  setFetchingSuggestion: React.Dispatch<React.SetStateAction<boolean>>;
  resetCategory: boolean;
  setResetCategory: React.Dispatch<React.SetStateAction<boolean>>;
  userHasManuallyChanged: boolean;
  setUserHasManuallyChanged: React.Dispatch<React.SetStateAction<boolean>>;
  isNewCategory: boolean;
  types: TaskType[];
  selectedKind: "UX/UI" | "Graphic";
  triggerSuggestion: number;
  isSubmitting: boolean;
  allCategories: any[];
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
  isSubmitting,
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
    
    console.log(`🔍 Current type ID for new category: ${typeId} (isNewCategory: ${isNewCategory}, selectedKind: ${selectedKind})`)
    
    return typeId
  }, [isNewCategory, selectedKind, types])

  // ✅ MEJORADO: Determinar duración manual para ambos tipos de categoría
  const effectiveManualDuration = React.useMemo(() => {
    const durationValue = values.durationDays as string;
    
    if (!durationValue || durationValue.trim() === '') return undefined;
    
    const parsedDuration = parseFloat(durationValue);
    if (isNaN(parsedDuration) || parsedDuration <= 0) return undefined;
    
    // ✅ NUEVO: Para categorías existentes, verificar si la duración difiere de la original
    if (!isNewCategory && values.categoryId) {
      // Buscar la categoría para comparar duraciones
      const allCategories = types.flatMap(type => type.categories);
      const selectedCategory = allCategories.find(cat => cat.id.toString() === values.categoryId);
      
      if (selectedCategory) {
        const categoryDuration = selectedCategory.duration;
        console.log(`🔍 Comparing durations - Category: ${categoryDuration}, Manual: ${parsedDuration}`);
        
        // Solo considerar como manual si es diferente a la duración de categoría
        if (Math.abs(categoryDuration - parsedDuration) > 0.1) {
          console.log(`✅ Duration is manual for existing category (${parsedDuration} vs ${categoryDuration})`);
          return durationValue;
        } else {
          console.log(`📋 Duration matches category default (${parsedDuration})`);
          return undefined; // No es manual, es la duración de categoría
        }
      }
    }
    
    // Para nuevas categorías, siempre considerar como manual si hay valor
    if (isNewCategory) {
      console.log(`🆕 Manual duration for new category: ${parsedDuration}`);
      return durationValue;
    }
    
    return undefined;
  }, [values.durationDays, values.categoryId, isNewCategory, types]);

  // ✅ Usar el hook actualizado con soporte para duración manual en categorías existentes
  const { suggestedAssignment, fetchingSuggestion } = useTaskSuggestion(
    isSubmitting ? '' : values.brandId,
    isSubmitting ? '' : values.categoryId,
    isSubmitting ? '' : values.priority,
    isSubmitting ? false : isNewCategory,
    isSubmitting ? undefined : effectiveManualDuration, // ✅ NUEVO: Pasar duración manual efectiva
    isSubmitting ? undefined : currentTypeId,
    isSubmitting ? 0 : triggerSuggestion
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

  // ✅ MEJORADO: Log para debugging del balanceamiento por duración
  useEffect(() => {
    if (suggestedAssignment) {
      console.log(`🔍 === BALANCE POR DURACIÓN DETECTADO ===`);
      console.log(`   - Usuario sugerido: ${suggestedAssignment.userId}`);
      console.log(`   - Duración de nueva tarea: ${suggestedAssignment.durationDays} días`);
      console.log(`   - Tipo de categoría: ${isNewCategory ? 'Nueva' : 'Existente'}`);
      console.log(`   - Duración manual activa: ${effectiveManualDuration || 'No'}`);
      console.log(`   - Fuente de duración: ${effectiveManualDuration ? 'Manual' : 'Categoría'}`);
    }
  }, [suggestedAssignment, isNewCategory, effectiveManualDuration]);

  useEffect(() => {
    // ✅ NO actualizar estado si está enviando
    if (isSubmitting) {
      return
    }

    setFetchingSuggestion(fetchingSuggestion)
    setSuggestedAssignment(suggestedAssignment)

    if (suggestedAssignment) {
      console.log(`🤖 Applying suggestion with duration balance: (userId: ${suggestedAssignment.userId}, durationDays: ${suggestedAssignment.durationDays}, isNewCategory: ${isNewCategory}, effectiveManualDuration: ${effectiveManualDuration})`)

      // ✅ MEJORADO: Lógica de aplicación de duración más inteligente
      if (!isNewCategory && !effectiveManualDuration) {
        // Categoría existente sin duración manual - aplicar duración de categoría
        setFieldValue("durationDays", suggestedAssignment.durationDays.toString())
        console.log(`📋 Applied category duration: ${suggestedAssignment.durationDays}`)
      } else if (isNewCategory && values.durationDays === "") {
        // Nueva categoría sin duración manual - aplicar sugerencia
        setFieldValue("durationDays", suggestedAssignment.durationDays.toString())
        console.log(`🆕 Applied suggested duration for new category: ${suggestedAssignment.durationDays}`)
      } else if (effectiveManualDuration) {
        // Duración manual activa - NO sobrescribir, mantener la manual
        console.log(`🔧 Keeping manual duration: ${effectiveManualDuration}`)
      }
      
      // Asignar usuario si no ha habido cambios manuales
      if (!userHasManuallyChanged) {
        if (
          values.assignedUserIds.length === 0 ||
          values.assignedUserIds[0] !== suggestedAssignment.userId
        ) {
          console.log(`🤖 Aplicando sugerencia de usuario balanceada: ${suggestedAssignment.userId}`)
          setFieldValue("assignedUserIds", [suggestedAssignment.userId])
        }
      } else {
        console.log('👤 Usuario ha hecho cambios manuales, manteniendo selección actual')
      }
    } else if (!fetchingSuggestion && !isNewCategory && values.brandId && values.categoryId && !effectiveManualDuration) {
      // Si no hay sugerencia para una categoría existente sin duración manual, vaciamos el campo
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
    isSubmitting,
    effectiveManualDuration // ✅ NUEVO: Dependencia clave para recalcular
  ])

  return null
}

export const CreateTaskForm: React.FC = () => {
  // ✅ CAMBIO: Extraer refreshTypes del hook para solo actualizar categorías
  const {
    types,
    brands,
    users,
    loading: dataLoading,
    refreshTypes,
  } = useTaskData();
  const [loading, setLoading] = useState(false);
  const [selectedKind, setSelectedKind] = useState<"UX/UI" | "Graphic">(
    "UX/UI"
  );
  const [resetCategory, setResetCategory] = useState(false);

  // ✅ Nuevo estado para trackear si se está escribiendo una nueva categoría
  const [isTypingNewCategory, setIsTypingNewCategory] = useState(false);
  // ✅ Nuevo estado para forzar actualización de sugerencias
  const [triggerSuggestion, setTriggerSuggestion] = useState(0);

  const [suggestedAssignment, setSuggestedAssignment] = useState<{
    userId: string;
    durationDays: number;
  } | null>(null);
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false);
  const [userHasManuallyChanged, setUserHasManuallyChanged] =
    useState<boolean>(false);

  const suggestedUser = suggestedAssignment
    ? users.find((u) => u.id === suggestedAssignment.userId)
    : null;

  useSocket();

  useEffect(() => {
    setResetCategory(true);
    setUserHasManuallyChanged(false);
    setIsTypingNewCategory(false);
  }, [selectedKind]);

  const filteredTypes = types.filter((type) => {
    const typeKind = getTypeKind(type.name);
    return typeKind === selectedKind;
  });

  const allCategories = filteredTypes.flatMap((type) =>
    type.categories.map((cat) => ({
      ...cat,
      typeName: type.name,
    }))
  );

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
  };

  const handleSubmit = async (
    values: ExtendedFormValues,
    { resetForm }: any
  ) => {
    try {
      let finalCategoryId = values.categoryId;
      let finalTypeId: number;
      let newCategoryCreated = false; // ✅ NUEVO: Flag para saber si creamos nueva categoría

      // Si es una nueva categoría, crearla primero
      if (values.isNewCategory) {
        if (!values.newCategoryName.trim()) {
          toast.error("Category name is required for new category");
          return;
        }

        if (!values.newCategoryTier) {
          toast.error("Tier selection is required for new category");
          return;
        }

        const finalDurationDays = parseFloat(values.durationDays as string);
        if (finalDurationDays <= 0) {
          toast.error("Duration must be greater than zero for new category");
          return;
        }

        // Encontrar el tipo correspondiente al selectedKind
        const selectedType = filteredTypes[0];
        if (!selectedType) {
          toast.error("No type found for the selected kind");
          return;
        }

        finalTypeId = selectedType.id;

        // Crear la nueva categoría
        console.log(
          `🆕 Creando nueva categoría: (name: ${values.newCategoryName.trim()}, duration: ${finalDurationDays}, tier: ${
            values.newCategoryTier
          }, typeId: ${finalTypeId})`
        );

        const categoryResponse = await axios.post("/api/categories", {
          name: values.newCategoryName.trim(),
          duration: finalDurationDays,
          tier: values.newCategoryTier,
          typeId: finalTypeId,
        });

        finalCategoryId = categoryResponse.data.id.toString();
        newCategoryCreated = true; // ✅ NUEVO: Marcar que se creó nueva categoría
        console.log(`✅ Nueva categoría creada con ID: ${finalCategoryId}`);
      } else {
        // Categoría existente
        const selectedCategory = allCategories.find(
          (cat) => cat.id.toString() === values.categoryId
        );
        if (!selectedCategory) {
          toast.error("Categoría seleccionada no encontrada");
          return;
        }
        finalTypeId = selectedCategory.typeId;
      }

      const finalDurationDays = parseFloat(values.durationDays as string);

      if (finalDurationDays <= 0) {
        toast.error("La duración de la tarea debe ser mayor a cero.");
        return;
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
      };

      setLoading(true);

      const taskResponse = await axios.post("/api/tasks", payload);
      const createdTask = taskResponse.data;

      setLoading(false);

      // ✅ NUEVO: Refrescar solo tipos/categorías si se creó nueva categoría
      if (newCategoryCreated) {
        console.log(
          "🔄 Refrescando categorías porque se creó nueva categoría..."
        );
        try {
          await refreshTypes();
          console.log("✅ Categorías refrescadas exitosamente");
        } catch (refreshError) {
          console.error("❌ Error al refrescar categorías:", refreshError);
          // No bloqueamos el flujo, solo logueamos el error
        }
      }

      const assignedUserNames =
        createdTask.assignees?.map((a: any) => a.user.name).join(", ") ??
        "somebody";

      const startDate = new Date(createdTask.startDate).toLocaleDateString(
        "es-PE",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
      const endDate = new Date(createdTask.deadline).toLocaleDateString(
        "es-PE",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      toast.success(
        <TaskCreatedToastContent
          assignedUserNames={assignedUserNames}
          startDate={startDate}
          endDate={endDate}
        />
      );

      setUserHasManuallyChanged(false);
      setIsTypingNewCategory(false);
      resetForm();
    } catch (error: unknown) {
      setLoading(false);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else if (axios.isAxiosError(error) && error.response?.data?.details) {
        toast.error(`Error: ${error.response.data.details}`);
      } else {
        toast.error("Error inesperado al crear la tarea");
      }
    }
  };

  const handleUserSelectionChange = (selectedUserIds: string[]) => {
    console.log("👤 Usuario cambió la selección manualmente:", selectedUserIds);
    setUserHasManuallyChanged(true);
    return selectedUserIds;
  };

  const applySuggestion = () => {
    if (suggestedAssignment) {
      console.log(
        `🤖 Aplicando sugerencia manualmente: ${suggestedAssignment.userId}`
      );
      setUserHasManuallyChanged(false);
    }
  };

  // ✅ Función para manejar cuando se completa la duración
  const handleDurationComplete = (duration: string, currentCategoryId: string, currentIsNewCategory: boolean) => {
    console.log(`⏰ Duration completed with balance check: ${duration}`)
    
    // ✅ NUEVO: Log de información de balanceamiento
    const allCategories = types.flatMap(type => type.categories);
    const selectedCategory = allCategories.find(cat => cat.id.toString() === currentCategoryId);
    
    if (selectedCategory && !currentIsNewCategory) {
      const parsedDuration = parseFloat(duration);
      const categoryDuration = selectedCategory.duration;
      
      console.log(`🎯 Balance check - Category duration: ${categoryDuration}, Manual: ${parsedDuration}`);
      
      if (Math.abs(categoryDuration - parsedDuration) > 0.1) {
        console.log(`🔄 Duration change detected - triggering balance recalculation`);
      } else {
        console.log(`📋 Duration matches category - using normal suggestion`);
      }
    }
    
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
          const handleCategoryChange = (
            value: string | null,
            isNew?: boolean,
            newCategoryName?: string
          ) => {
            console.log(
              `📋 Category change: (value: ${value}, isNew: ${isNew}, newCategoryName: ${newCategoryName})`
            );

            setFieldValue("categoryId", value || "");
            setFieldValue("isNewCategory", isNew || false);
            setFieldValue("newCategoryName", newCategoryName || "");

            if (isNew) {
              // Si es nueva categoría, limpiar duración para que sea manual
              setFieldValue("durationDays", "");
              setFieldValue("assignedUserIds", []);
              setFieldValue("newCategoryTier", null); // Limpiar tier
              setSuggestedAssignment(null);

              if (
                values.durationDays &&
                parseFloat(values.durationDays as string) > 0
              ) {
                console.log(
                  "🔄 Triggering suggestion for new category with existing duration"
                );
                setTriggerSuggestion((prev) => prev + 1);
              }
            } else {
              // Para categoría existente, NO limpiar automáticamente
              setFieldValue("assignedUserIds", []);
              setSuggestedAssignment(null);
              setFieldValue("newCategoryTier", null); // Limpiar tier cuando no es nueva categoría
            }
            setUserHasManuallyChanged(false);
          };

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
                isSubmitting={isSubmitting}
                allCategories={allCategories}
              />

              <TaskKindSwitch
                selectedKind={selectedKind}
                onKindChange={(kind) => {
                  setSelectedKind(kind);
                  setTimeout(() => {
                    setFieldValue("categoryId", "");
                    setFieldValue("durationDays", "");
                    setFieldValue("assignedUserIds", []);
                    setFieldValue("isNewCategory", false);
                    setFieldValue("newCategoryName", "");
                    setFieldValue("newCategoryTier", null);
                    setSuggestedAssignment(null);
                    setUserHasManuallyChanged(false);
                    setIsTypingNewCategory(false);
                  }, 0);
                }}
              />

              <TaskNameField touched={touched.name} error={errors.name} />

              <BrandSelect
                brands={brands}
                value={values.brandId}
                onChange={(value) => {
                  setFieldValue("brandId", value);
                  setTimeout(() => {
                    setFieldValue("assignedUserIds", []);
                    setSuggestedAssignment(null);
                    setUserHasManuallyChanged(false);
                  }, 0);
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
                      setFieldValue("assignedUserIds", []);
                      setSuggestedAssignment(null);
                    }
                    setUserHasManuallyChanged(false);
                  }, 0);
                }}
                touched={touched.categoryId}
                error={errors.categoryId}
                loading={dataLoading}
                selectedTier={values.newCategoryTier}
                onTierChange={(tier) => setFieldValue("newCategoryTier", tier)}
                showTierSelection={values.isNewCategory}
                onTypingNewCategory={setIsTypingNewCategory}
                tierTouched={touched.newCategoryTier}
                tierError={errors.newCategoryTier}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => {
                  setFieldValue("priority", value);
                  if (!values.isNewCategory) {
                    // Al cambiar prioridad en categoría existente, no limpiar duración automáticamente
                    // La lógica de sugerencias se encargará de esto
                  }
                  if (!values.isNewCategory) {
                    setUserHasManuallyChanged(false);
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
                // Pass categoryId and isNewCategory to handleDurationComplete
                onDurationComplete={(duration) => handleDurationComplete(duration, values.categoryId, values.isNewCategory)}
                allCategories={allCategories}
              />

              <UserAssignmentSelect
                users={users}
                values={values.assignedUserIds}
                onChange={(selectedUserIds) => {
                  const newSelection =
                    handleUserSelectionChange(selectedUserIds);
                  setFieldValue("assignedUserIds", newSelection);
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
                  isSubmitting ||
                  (brands.length === 0 && !dataLoading)
                }
                size="lg"
              >
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>

              {brands.length === 0 && !dataLoading && (
                <Typography level="body-xs" color="warning" textAlign="center">
                  No hay brands activos disponibles
                </Typography>
              )}
            </Form>
          );
        }}
      </Formik>
    </>
  );
};
