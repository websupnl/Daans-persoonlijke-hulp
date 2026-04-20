'use client'

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const projects = [
  { name: 'Website Redesign', status: 'Paid', team: 'Frontend Team', budget: '$12,500' },
  { name: 'Mobile App', status: 'Unpaid', team: 'Mobile Team', budget: '$8,750' },
  { name: 'API Integration', status: 'Pending', team: 'Backend Team', budget: '$5,200' },
]

export default function TableDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl" data-slot="frame">
        <Table>
          <TableCaption>A list of current projects.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Budget</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.name}>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>{project.status}</TableCell>
                <TableCell>{project.team}</TableCell>
                <TableCell className="text-right">{project.budget}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Total Budget</TableCell>
              <TableCell className="text-right">$26,450</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
