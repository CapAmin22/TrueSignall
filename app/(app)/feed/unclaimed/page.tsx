import { redirect } from "next/navigation";

/** S2b · Unclaimed view (TC-03) — rendered by the feed's view toggle. */
export default function UnclaimedPage() {
  redirect("/feed?view=unclaimed");
}
