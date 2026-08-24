import { requireOwner } from "@/lib/auth/requireOwner";
import CoreClient from "./CoreClient";

export default async function CorePage() {
  await requireOwner();

  return <CoreClient />;
}
