// src/stores/modalStore.ts
import { create } from 'zustand'

export type ModalSize = 'sm' | 'md' | 'lg'

interface ModalState {
  isOpen: boolean
  title: string
  content: React.ReactNode | null
  size: ModalSize
  onClose?: () => void
}

interface ModalActions {
  openModal: (config: {
    title: string
    content: React.ReactNode
    size?: ModalSize
    onClose?: () => void
  }) => void
  closeModal: () => void
  setSize: (size: ModalSize) => void
}

export const useModalStore = create<ModalState & ModalActions>((set, get) => ({
  // State
  isOpen: false,
  title: '',
  content: null,
  size: 'md',
  onClose: undefined,

  // Actions
  openModal: (config) => {
    set({
      isOpen: true,
      title: config.title,
      content: config.content,
      size: config.size || 'md',
      onClose: config.onClose,
    })
  },

  closeModal: () => {
    const { onClose } = get()
    if (onClose) {
      onClose()
    }
    set({
      isOpen: false,
      title: '',
      content: null,
      onClose: undefined,
    })
  },

  setSize: (size) => {
    set({ size })
  },
}))