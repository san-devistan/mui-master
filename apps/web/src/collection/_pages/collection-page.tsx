import { CollectionGrid } from "@/collection/_components/collection-grid"
import { CollectionProgress } from "@/collection/_components/collection-progress"
import { PackReveal } from "@/collection/_components/pack-reveal"
import type { PulledCard } from "@/collection/_lib/card-format"
import { useCollectorKey } from "@/collection/_lib/collector-key"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Disc3Icon, PackageOpenIcon } from "lucide-react"
import { useState } from "react"

export function CollectionPage() {
  const collectorKey = useCollectorKey()
  const queryClient = useQueryClient()
  const summaryQuery = convexQuery(
    api.collection.summary,
    collectorKey ? { collectorKey } : "skip"
  )
  const summary = useQuery(summaryQuery)
  const openPack = useMutation({
    mutationFn: useConvexMutation(api.collection.openPack),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: summaryQuery.queryKey }),
  })
  const [pulls, setPulls] = useState<ReadonlyArray<PulledCard> | null>(null)
  const totalSongs = summary.data?.totalSongs ?? 0
  const canPlay = summary.isSuccess && totalSongs > 0

  function handleOpenPack() {
    if (collectorKey) {
      openPack.mutate({ collectorKey }, { onSuccess: setPulls })
    }
  }

  return (
    <main className="max-w-5xl gap-6 px-4 pt-6 pb-28 mx-auto flex min-h-svh w-full flex-col">
      <header className="gap-1 flex flex-col">
        <p className="gap-2 text-sm flex items-center text-muted-foreground">
          <Disc3Icon className="size-4" aria-hidden="true" />
          Music TCG prototype
        </p>
        <h1 className="text-2xl font-bold font-heading">Musi Master</h1>
      </header>

      {summary.isPending ? <SummarySkeleton /> : null}
      {summary.isError ? <BackendUnavailable /> : null}
      {summary.isSuccess && totalSongs === 0 ? <EmptyCatalog /> : null}

      {canPlay && collectorKey ? (
        <>
          <CollectionProgress {...summary.data} />
          {pulls ? (
            <PackReveal pulls={pulls} onDone={() => setPulls(null)} />
          ) : (
            <CollectionGrid collectorKey={collectorKey} />
          )}
        </>
      ) : null}

      <div className="inset-x-0 bottom-0 px-4 pt-3 pb-6 backdrop-blur fixed border-t bg-background/90">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            className="w-full"
            disabled={!canPlay || openPack.isPending}
            onClick={handleOpenPack}
          >
            <PackageOpenIcon data-icon="inline-start" aria-hidden="true" />
            {openPack.isPending ? "Opening…" : "Open a pack"}
          </Button>
          {openPack.isError ? (
            <p
              role="alert"
              className="mt-2 text-sm text-center text-destructive"
            >
              Could not open a pack. Try again.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function BackendUnavailable() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Backend unavailable</EmptyTitle>
        <EmptyDescription>Start Convex and reload the page.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function EmptyCatalog() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Disc3Icon />
        </EmptyMedia>
        <EmptyTitle>No songs yet</EmptyTitle>
        <EmptyDescription>
          Run the Audiometa song import to fill the catalog.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function SummarySkeleton() {
  return (
    <div className="gap-3 sm:grid-cols-3 lg:grid-cols-5 grid grid-cols-2">
      {["one", "two", "three", "four"].map((key) => (
        <Skeleton key={key} className="aspect-5/7" />
      ))}
    </div>
  )
}
