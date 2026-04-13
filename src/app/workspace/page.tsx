import { redirect } from "next/navigation";

/** Former “all modules” view removed; bookmarks redirect home. */
export default function WorkspaceRedirectPage() {
  redirect("/");
}
