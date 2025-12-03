import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
  action?: {
    label: string
    handler: () => void
  }
}

const toasts = ref<Toast[]>([])
let toastId = 0

export function useToast() {
  function show(
    message: string,
    options?: {
      type?: 'info' | 'success' | 'error'
      duration?: number
      action?: { label: string; handler: () => void }
    }
  ): void {
    const id = ++toastId
    const toast: Toast = {
      id,
      message,
      type: options?.type || 'info',
      action: options?.action
    }

    toasts.value.push(toast)

    const duration = options?.duration ?? 3000
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, duration)
    }
  }

  function dismiss(id: number): void {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function dismissAll(): void {
    toasts.value = []
  }

  return {
    toasts,
    show,
    dismiss,
    dismissAll
  }
}
