import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const cookieStore = await cookies();

  // Try common cookie names used in your app
  const token =
    cookieStore.get("cap_auth_token")?.value ||
    cookieStore.get("auth_token")?.value ||
    cookieStore.get("token")?.value ||
    cookieStore.get("session")?.value;

  if (token) {
    redirect("/dashboard");
  }

  redirect("/login");
}