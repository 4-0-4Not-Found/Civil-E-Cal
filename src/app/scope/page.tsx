import { redirect } from "next/navigation";

/** Legacy URL — use /info */
export default function LegacyScopeRedirect() {
  redirect("/info");
}
