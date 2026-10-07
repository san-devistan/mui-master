import { CollectionPage } from "@/collection/_pages/collection-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: CollectionPage })
