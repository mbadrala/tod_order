import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductInput,
} from "@/lib/api";
import * as XLSX from "xlsx";

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
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

  const filteredProducts = useMemo(() => {
    const codeQ = searchCode.toLowerCase().trim();
    const nameQ = searchName.toLowerCase().trim();
    return products.filter((p) => {
      if (codeQ && !p.code.toLowerCase().includes(codeQ)) return false;
      if (nameQ && !p.name.toLowerCase().includes(nameQ)) return false;
      return true;
    });
  }, [products, searchCode, searchName]);

  const exportExcel = () => {
    const headers = ["Код", "Нэр", "Бүртгэгдсэн"];
    const body = filteredProducts.map((p) => [
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

  const load = async () => {
    try {
      setProducts(await getProducts());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      await load();
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

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

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
            {table.getRowModel().rows.length === 0 ? (
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
        <span>Нийт: {filteredProducts.length} мөр</span>
        <span>
          {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            filteredProducts.length,
          )}{" "}
          / {filteredProducts.length}
        </span>
      </div>

      {table.getPageCount() > 1 && (
        <Pagination className="mt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => table.previousPage()}
                className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: table.getPageCount() }, (_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  onClick={() => table.setPageIndex(i)}
                  isActive={table.getState().pagination.pageIndex === i}
                  className="cursor-pointer"
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => table.nextPage()}
                className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export default ProductsPage;
