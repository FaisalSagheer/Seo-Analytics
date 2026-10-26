import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

async function Redirector() {
  const session = await getSession();
  redirect(session ? "/projects" : "/sign-in");
  return null;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
