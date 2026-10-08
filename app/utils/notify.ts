import { toast } from 'vue-sonner'

// Shared wording for the toasts every app shows (CHECKLIST.md #21)

/** After a soft delete: says where it went and offers Undo */
export function toastDeleted(name: string, undo?: () => void) {
  toast(`${name} deleted`, {
    description: 'Moved to the Recycle Bin.',
    duration: 6000,
    action: undo ? { label: 'Undo', onClick: undo } : undefined
  })
}

/** After an edit: offers to put back how it was */
export function toastSaved(undo?: () => void, title = 'Changes saved') {
  toast.success(title, {
    duration: 5000,
    action: undo ? { label: 'Undo', onClick: undo } : undefined
  })
}
