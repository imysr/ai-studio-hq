import { requireOwner } from "@/lib/auth/requireOwner";
import AgentClient from "./AgentClient";

export default async function AgentPage() {
  await requireOwner();

  return <AgentClient />;
}
