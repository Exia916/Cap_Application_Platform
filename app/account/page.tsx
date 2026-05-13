import AccountClient from "./AccountClient";

export default function AccountPage() {
  return (
    <main className="page-shell">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">
            Manage your CAP account settings and security setup.
          </p>
        </div>
      </div>

      <AccountClient />
    </main>
  );
}