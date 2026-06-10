import { useEffect, useState, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getPaginationRowModel,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  getProducts,
  getProductsAll,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductInput,
} from "@/lib/api";
import * as XLSX from "xlsx";
import { getPageNumbers } from "@/lib/utils";

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "code", desc: false },
  ]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductInput>({ code: "", name: "" });
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.is_admin;
  const perPage = 50;

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getProducts({ code: searchCode, name: searchName, page: p, per_page: perPage });
      setProducts(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [searchCode, searchName]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchCode, searchName, load]);

  const exportExcel = async () => {
    const all = await getProductsAll({ code: searchCode, name: searchName });
    const headers = ["Код", "Нэр", "Бүртгэгдсэн"];
    const body = all.map((p) => [
      p.code,
      p.name,
      p.created_at?.slice(0, 10) || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Бараа");
    XLSX.writeFile(
      wb,
      `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const resetForm = () => {
    setForm({ code: "", name: "" });
    setEditId(null);
    setError("");
  };

  const openEdit = (p: Product) => {
    setForm({ code: p.code, name: p.name });
    setEditId(p.id);
    setError("");
    setOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const setField = (key: keyof ProductInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.code.trim() || !form.name.trim()) {
      setError("Код болон нэр шаардлагатай");
      return;
    }
    try {
      if (editId) {
        await updateProduct(editId, {
          code: form.code.trim(),
          name: form.name.trim(),
        });
      } else {
        await createProduct({ code: form.code.trim(), name: form.name.trim() });
      }
      resetForm();
      setOpen(false);
      await load(page);
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
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "code",
      header: "Код",
    },
    {
      accessorKey: "name",
      header: "Нэр",
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
            cell: ({ row }: { row: { original: Product } }) => (
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
                    handleDelete(row.original.id, row.original.name)
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

  const pageCount = Math.ceil(total / perPage);

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: perPage, pageIndex: page - 1 } },
  });

  const goPage = (p: number) => {
    setPage(p);
    load(p);
  };

  return (
    <div className="mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Бараа</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            Excel экспорт
          </Button>
          {isAdmin && <Button onClick={openCreate}>Шинэ бараа</Button>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Кодоор хайх..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
        <input
          placeholder="Нэрээр хайх..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
      </div>

      <Separator className="mb-4" />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Бараа устгах"
        message={`"${deleteTarget?.name ?? ""}"-г устгах уу?`}
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
            <DialogTitle>{editId ? "Бараа засах" : "Шинэ бараа"}</DialogTitle>
            <div className="mt-4 space-y-3">
              <input
                placeholder="Код *"
                value={form.code}
                onChange={(e) => setField("code", e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
              <input
                placeholder="Нэр *"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
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
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  Уншиж байна...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  Одоогоор бараа байхгүй
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

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Нийт: {total} мөр</span>
        <span>
          {(page - 1) * perPage + 1}–
          {Math.min(page * perPage, total)} / {total}
        </span>
      </div>

      {pageCount > 1 && (
        <Pagination className="mt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => goPage(page - 1)}
                className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {getPageNumbers(page, pageCount).map((p, i) =>
              p === "..." ? (
                <PaginationItem key={`e${i}`}>
                  <span className="px-2 text-muted-foreground">...</span>
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    onClick={() => goPage(p)}
                    isActive={page === p}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => goPage(page + 1)}
                className={page >= pageCount ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export default ProductsPage;
