import { useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  type BankAccount,
  type BankAccountInput,
} from "@/lib/api";

function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "bank_name", desc: false },
  ]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BankAccountInput>({
    bank_name: "",
    account_number: "",
    account_name: "",
  });
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.is_admin;

  const load = async () => {
    try {
      setAccounts(await getBankAccounts());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ bank_name: "", account_number: "", account_name: "" });
    setEditId(null);
    setError("");
  };

  const openEdit = (a: BankAccount) => {
    setForm({
      bank_name: a.bank_name,
      account_number: a.account_number,
      account_name: a.account_name,
    });
    setEditId(a.id);
    setError("");
    setOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const setField = (key: keyof BankAccountInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    if (
      !form.bank_name.trim() ||
      !form.account_number.trim() ||
      !form.account_name.trim()
    ) {
      setError("Банкны нэр, дансны нэр болон дансны дугаар шаардлагатай");
      return;
    }
    try {
      if (editId) {
        await updateBankAccount(editId, {
          bank_name: form.bank_name.trim(),
          account_number: form.account_number.trim(),
          account_name: form.account_name.trim(),
        });
      } else {
        await createBankAccount({
          bank_name: form.bank_name.trim(),
          account_number: form.account_number.trim(),
          account_name: form.account_name.trim(),
        });
      }
      resetForm();
      setOpen(false);
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
      await deleteBankAccount(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const columns: ColumnDef<BankAccount>[] = [
    {
      accessorKey: "id",
      header: "Д/д",
    },
    {
      accessorKey: "account_name",
      header: "Дансны нэр",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v || "-";
      },
    },
    {
      accessorKey: "bank_name",
      header: "Банкны нэр",
    },
    {
      accessorKey: "account_number",
      header: "Дансны дугаар",
    },
    {
      accessorKey: "created_at",
      header: "Огноо",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleDateString("mn-MN") : "-";
      },
    },
    ...(isAdmin
      ? [
          {
            id: "actions" as const,
            header: "Үйлдэл",
            cell: ({ row }: { row: { original: BankAccount } }) => (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => openEdit(row.original)}
                >
                  Засах
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="text-destructive"
                  onClick={() =>
                    handleDelete(row.original.id, row.original.bank_name)
                  }
                >
                  Устгах
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const table = useReactTable({
    data: accounts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Банкны данс</h1>
        {isAdmin && <Button onClick={openCreate}>Шинэ данс</Button>}
      </div>

      <Separator className="mb-4" />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Данс устгах"
        message={`"${deleteTarget?.name ?? ""}" дансыг устгах уу?`}
        onConfirm={confirmDelete}
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setOpen(v);
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <DialogTitle>{editId ? "Данс засах" : "Шинэ данс"}</DialogTitle>
            <div className="mt-4 space-y-3">
              <input
                placeholder="Дансны нэр *"
                value={form.account_name}
                onChange={(e) => setField("account_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
              <input
                placeholder="Банкны нэр *"
                value={form.bank_name}
                onChange={(e) => setField("bank_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
              <input
                placeholder="Дансны дугаар *"
                value={form.account_number}
                onChange={(e) => setField("account_number", e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
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

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.getCanSort()
                        ? "cursor-pointer select-none hover:text-foreground/80"
                        : ""
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {{ asc: " ▲", desc: " ▼" }[
                      header.column.getIsSorted() as string
                    ] ?? ""}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  Одоогоор данс байхгүй
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default BankAccountsPage;
