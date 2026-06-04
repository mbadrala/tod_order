import { useNavigate, useLocation, Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

function navItems(isAdmin: boolean) {
  const items = [
    { label: "Нүүр", path: "/" },
    { label: "Үйлчлүүлэгчид", path: "/clients" },
    { label: "Бүтээгдэхүүн", path: "/products" },
  ]
  if (isAdmin) items.push({ label: "Хэрэглэгчид", path: "/users" })
  return items
}

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="flex h-svh">
      <aside className="flex w-60 flex-col border-r bg-muted/30">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <span className="text-sm font-semibold">ТОД ОЙМС ХХК</span>
        </div>

        <Separator />

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems(user.is_admin).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {item.label}
            </Link>
          ))}
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

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
