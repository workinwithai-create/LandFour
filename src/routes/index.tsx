import { createFileRoute } from "@tanstack/react-router";
import { LandDesk } from "@/components/land-desk";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <LandDesk />;
}
