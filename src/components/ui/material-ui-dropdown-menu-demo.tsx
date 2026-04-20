import React from 'react'
import { MoreHorizontal, Trash2, Pencil, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'

export default function MaterialUiDropdownMenuDemo() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/20">
      <DropdownMenu>
        <DropdownMenuTrigger className="h-10 w-10 rounded-full border border-outline-variant bg-white text-on-surface">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[14rem] rounded-2xl bg-white">
          <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
          <DropdownMenuItem>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span>AI context</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <span>Bewerken</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="h-4 w-4" />
            <span>Verwijderen</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
