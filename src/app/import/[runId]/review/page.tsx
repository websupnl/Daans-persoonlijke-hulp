import AppShell from '@/components/layout/AppShell'
import ImportReviewView from '@/components/import/ImportReviewView'

export default function ImportReviewPage({ params }: { params: { runId: string } }) {
  return (
    <AppShell>
      <ImportReviewView runId={parseInt(params.runId)} />
    </AppShell>
  )
}
