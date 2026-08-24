import { requireOwner } from "@/lib/auth/requireOwner";
import MissionsClient from "./MissionsClient";

export default async function MissionsPage() {
  await requireOwner();

  return <MissionsClient />;
}
