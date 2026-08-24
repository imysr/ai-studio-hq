import { requireOwner } from "@/lib/auth/requireOwner";
import HQClient from "./HQClient";

export default async function HQPage() {
  await requireOwner();

  return <HQClient />;
}
