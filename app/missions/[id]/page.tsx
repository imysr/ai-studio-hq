import { requireOwner } from "@/lib/auth/requireOwner";
import MissionDetailClient from "./MissionDetailClient";

export default async function MissionDetailPage() {
  await requireOwner();

  return <MissionDetailClient />;
}
