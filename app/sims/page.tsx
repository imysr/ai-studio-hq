import { requireOwner } from "@/lib/auth/requireOwner";
import SimsClient from "./SimsClient";

export default async function SimsPage() {
  await requireOwner();

  return <SimsClient />;
}
