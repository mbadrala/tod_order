import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getUsers, createUser, updateUser, deleteUser } from "@/lib/api";

const ALL_PERMISSIONS = [
  { key: "sales", label: "Борлуулалт" },
  { key: "reports", label: "Тайлан" },
  { key: "clients", label: "Харилцагчид" },
  { key: "products", label: "Бараа" },
];

interface User {
  id: number;
  name: string;
  username: string;
  is_admin: number;
  permissions: string[];
  created_at: string;
}

function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editingIsAdmin, setEditingIsAdmin] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const load = async () => {
    try {
      setUsers(await getUsers());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setName("");
    setUsername("");
    setPassword("");
    setPermissions([]);
    setEditId(null);
    setEditingIsAdmin(false);
    setError("");
  };

  const openCreate = () => {
    resetForm();
    setEditingIsAdmin(false);
    setPermissions(ALL_PERMISSIONS.map((p) => p.key));
    setOpen(true);
  };

  const openEdit = (u: User) => {
    setName(u.name);
    setUsername(u.username);
    setPassword("");
    setPermissions(u.permissions || []);
    setEditId(u.id);
    setEditingIsAdmin(!!u.is_admin);
    setError("");
    setOpen(true);
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!name.trim() || !username.trim()) {
      setError("Нэр болон нэвтрэх нэр шаардлагатай");
      return;
    }
    try {
      if (editId) {
        await updateUser(editId, {
          name: name.trim(),
          username: username.trim(),
          permissions,
          ...(password ? { password } : {}),
        });
      } else {
        if (!password || password.length < 6) {
          setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой");
          return;
        }
        await createUser({
          name: name.trim(),
          username: username.trim(),
          password,
          permissions,
        });
      }
      setOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  return (
    <div className="mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Хэрэглэгчид</h1>
        <Button onClick={openCreate}>
          Шинэ хэрэглэгч
        </Button>
      </div>

      <Separator className="mb-4" />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Нэр</th>
              <th className="px-4 py-3 font-medium">Нэвтрэх нэр</th>
              <th className="px-4 py-3 font-medium">Эрх</th>
              <th className="px-4 py-3 font-medium">Хандах эрхүүд</th>
              <th className="px-4 py-3 font-medium">Бүртгэгдсэн</th>
              <th className="px-4 py-3 font-medium">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">{u.id}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Админ
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Хэрэглэгч</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {ALL_PERMISSIONS.map((p) => (
                      <span
                        key={p.key}
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          u.permissions?.includes(p.key)
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.created_at?.slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => openEdit(u)}
                    >
                      Засах
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-destructive"
                      disabled={!!u.is_admin}
                      onClick={() => handleDelete(u.id, u.name)}
                    >
                      Устгах
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); resetForm(); } }}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <DialogTitle>{editId ? "Хэрэглэгч засах" : "Шинэ хэрэглэгч"}</DialogTitle>
            <div className="mt-4 space-y-3">
              <input
                placeholder="Нэр *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
              <input
                placeholder="Нэвтрэх нэр *"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
              <input
                type="password"
                placeholder={editId ? "Шинэ нууц үг (хоосон)" : "Нууц үг *"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
              {!editingIsAdmin && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Хандах эрхүүд</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PERMISSIONS.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted has-checked:border-primary has-checked:bg-primary/5"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(p.key)}
                          onChange={() => togglePermission(p.key)}
                          className="size-3.5"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={handleSubmit}>
                {editId ? "Хадгалах" : "Бүртгэх"}
              </Button>
              <DialogClose
                render={
                  <Button variant="outline" className="flex-1">
                    Цуцлах
                  </Button>
                }
              />
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Хэрэглэгч устгах"
        message={`${deleteTarget?.name ?? ""} хэрэглэгчийг устгах уу?`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default UsersPage;
