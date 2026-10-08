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

/** Star or unstar a record (CHECKLIST.md #66); favourites show on the home page */
export function toggleFavourite<T extends { id: string, favorite?: boolean }>(item: T, name: string, update: (id: string, patch: Partial<T>) => T | undefined, replace: (item: T) => void) {
  const before = update(item.id, { favorite: !item.favorite } as Partial<T>)
  toast(item.favorite ? `${name} removed from favourites` : `${name} added to favourites`, {
    description: item.favorite ? undefined : 'It’s on your home page now.',
    action: before ? { label: 'Undo', onClick: () => replace(before) } : undefined
  })
}
