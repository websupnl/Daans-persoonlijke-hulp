'use client'

import { EditableChip } from '@/components/ui/editable-chip'

export default function EditableChipDemo() {
  return (
    <EditableChip
      defaultLabel="Favorites"
      onChange={(value) => console.log('Saved:', value)}
    />
  )
}
