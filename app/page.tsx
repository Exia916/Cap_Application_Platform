import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import { getExternalPartnerContextForUserId } from "@/lib/repositories/externalPartnerRepo";

export default async function HomePage() {
  const cookieStore = await cookies();

  // Try common cookie names used in your app
  const token =
    cookieStore.get("cap_auth_token")?.value ||
    cookieStore.get("auth_token")?.value ||
    cookieStore.get("token")?.value ||
    cookieStore.get("session")?.value;

  if (token) {
    const auth = verifyJwt(token);

    if (auth?.id) {
      const externalContext = await getExternalPartnerContextForUserId(auth.id);

      if (externalContext) {
        redirect("/partner-work/workflow");
      }
    }

    redirect("/dashboard");
  }

  redirect("/login");
}
