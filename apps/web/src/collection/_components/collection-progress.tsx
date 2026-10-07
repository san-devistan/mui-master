import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@workspace/ui/components/progress"

type CollectionProgressProps = {
  ownedSongs: number
  totalSongs: number
  packsOpened: number
}

export function CollectionProgress({
  ownedSongs,
  totalSongs,
  packsOpened,
}: CollectionProgressProps) {
  return (
    <Progress value={(ownedSongs / totalSongs) * 100}>
      <ProgressLabel>
        {ownedSongs}/{totalSongs} songs collected
      </ProgressLabel>
      <ProgressValue>
        {() =>
          `${String(packsOpened)} ${packsOpened === 1 ? "pack" : "packs"} opened`
        }
      </ProgressValue>
    </Progress>
  )
}
