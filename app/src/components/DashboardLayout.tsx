import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { getMe } from "@/lib/api";

function navItems(isAdmin: boolean, permissions: string[]) {
  const allCommon = [
    { label: "Борлуулалт", path: "/", permission: "sales" },
    { label: "Тайлан", path: "/reports", permission: "reports" },
    { label: "Харилцагчид", path: "/clients", permission: "clients" },
    { label: "Бараа", path: "/products", permission: "products" },
  ]
  const common = isAdmin
    ? allCommon
    : allCommon.filter((item) => permissions.includes(item.permission))
  const admin = isAdmin
    ? [
        { label: "Нэгтгэл", path: "/sales-summary" },
        { label: "Банкны данс", path: "/bank-accounts" },
        { label: "Хэрэглэгчид", path: "/users" },
        { label: "Системийн лог", path: "/logs" },
      ]
    : []
  return { common, admin }
}

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "{}"));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getMe().then((data) => {
      localStorage.setItem("user", JSON.stringify(data));
      setUser(data);
    }).catch(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-svh">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={closeSidebar} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-background transition-transform duration-200 sm:static sm:z-auto sm:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <span className="text-sm font-semibold">ТОД ОЙМС ХХК</span>
        </div>

        <Separator />

        <nav className="flex-1 space-y-1 px-3 py-4">
          {(() => { const { common, admin } = navItems(user.is_admin, user.permissions || []); return (
            <>
              {common.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeSidebar}
                  className={`flex rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {admin.length > 0 && (
                <>
                  <div className="pt-4 pb-1 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Админ удирдлага
                  </div>
                  {admin.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeSidebar}
                      className={`flex rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        location.pathname === item.path
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
            </>
          )})()}
        </nav>

        <Separator />

        <div className="space-y-2 px-3 py-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar size="sm">
              <AvatarFallback>
                {(user.name?.[0] || "Х").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{user.name || "Хэрэглэгч"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.username}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Гарах
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <header className="flex items-center gap-3 border-b px-4 py-3 sm:hidden">
          <button onClick={() => setSidebarOpen(true)} className="-ml-1 rounded-lg p-1 hover:bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <img src="/logo.png" alt="Logo" className="h-7 w-auto" />
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
