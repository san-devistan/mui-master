import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

// A player's round picture, ringed in ink; without one, their initial on the
// brand gradient.
function GameAvatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <Avatar data-slot="game-avatar" className="size-20 md:size-24">
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="text-4xl md:text-5xl font-black font-heading text-brand-foreground game-brand-fill">
        {name.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export { GameAvatar }
