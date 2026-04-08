// app/admin/recuts-all/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/auth";
import RecutsAllTable from "./RecutsAllTable";

export const runtime = "nodejs";

const ALLOWED = new Set(["ADMIN", "SUPERVISOR", "MANAGER"]);

function yyyymmdd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function RecutsAllPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) redirect("/login");

  const payload: any = verifyJwt(token);
  if (!payload) redirect("/login");

  const role = String(payload.role || "").toUpperCase();
  if (!ALLOWED.has(role)) redirect("/dashboard");

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Recuts — All (Managers)
      </h1>

      <div style={{ marginBottom: 12, color: "#444" }}>
        Server-side filtering • Pagination • CSV Export
      </div>

      <div style={{ width: "calc(100vw - 32px)", marginLeft: "calc(50% - 50vw + 16px)" }}>
        <RecutsAllTable defaultStart={yyyymmdd(start)} defaultEnd={yyyymmdd(end)} />
      </div>
    </div>
  );
}