import Link from "next/link";
import PlaybooksAdminTable from "./PlaybooksAdminTable";

export default function AdminPlaybooksPage() {
  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Playbooks Admin</h1>
          <p className="page-subtitle">
            Create, publish, archive, and maintain Playbook articles.
          </p>
        </div>

        <Link href="/admin/playbooks/new" className="btn btn-primary">
          + New Playbook
        </Link>
      </div>

      <PlaybooksAdminTable />
    </div>
  );
}