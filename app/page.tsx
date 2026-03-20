import { redirect } from "next/navigation";

/**
 * Root URL shows the real dashboard. Monarch OS UI lives in app/admin/page.tsx.
 * Visiting / was still serving an old mock page — this fixes "nothing changed" on galacreate.com.
 */
export default function RootPage() {
  redirect("/admin");
}
