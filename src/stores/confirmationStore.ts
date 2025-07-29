// src/stores/confirmationStore.ts
import { create } from 'zustand'

export type ConfirmationType = 'danger' | 'warning' | 'info'

interface ConfirmationState {
  isOpen: boolean
  title: string
  description: string
  type: ConfirmationType
  confirmText: string
  cancelText: string
  onConfirm: (() => void) | null
  onCancel: (() => void) | null
  loading: boolean
}

interface ConfirmationActions {
  openConfirmation: (config: {
    title: string
    description: string
    type?: ConfirmationType
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel?: () => void
  }) => void
  closeConfirmation: () => void
  setLoading: (loading: boolean) => void
}

type ConfirmationStore = ConfirmationState & ConfirmationActions

export const useConfirmationStore = create<ConfirmationStore>((set, get) => ({
  // State
  isOpen: false,
  title: '',
  description: '',
  type: 'danger',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  onConfirm: null,
  onCancel: null,
  loading: false,

  // Actions
  openConfirmation: (config) => {
    set({
      isOpen: true,
      title: config.title,
      description: config.description,
      type: config.type || 'danger',
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      onConfirm: config.onConfirm,
      onCancel: config.onCancel || null,
      loading: false,
    })
  },

  closeConfirmation: () => {
    const { onCancel } = get()
    if (onCancel) onCancel()
    
    set({
      isOpen: false,
      title: '',
      description: '',
      type: 'danger',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: null,
      onCancel: null,
      loading: false,
    })
  },

  setLoading: (loading) => set({ loading }),
}))