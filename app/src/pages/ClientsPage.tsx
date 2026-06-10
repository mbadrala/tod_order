import { useEffect, useState, useRef, useMemo } from "react";
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
  getClients,
  createClient,
  updateClient,
  deleteClient,
  uploadFile,
  getFileUrl,
  type Client,
  type ClientInput,
} from "@/lib/api";
import * as XLSX from "xlsx";

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientInput>({});
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const isAdmin = JSON.parse(localStorage.getItem("user") || "{}").is_admin;

  const filteredClients = useMemo(() => {
    const codeQ = searchCode.toLowerCase().trim();
    const nameQ = searchName.toLowerCase().trim();
    const phoneQ = searchPhone.toLowerCase().trim();
    return clients.filter((c) => {
      if (
        codeQ &&
        !(c.client_code && c.client_code.toLowerCase().includes(codeQ))
      )
        return false;
      if (nameQ && !(c.name && c.name.toLowerCase().includes(nameQ)))
        return false;
      if (phoneQ && !(c.phone && c.phone.toLowerCase().includes(phoneQ)))
        return false;
      return true;
    });
  }, [clients, searchCode, searchName, searchPhone]);

  const load = async () => {
    try {
      setClients(await getClients());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({});
    setEditId(null);
    setError("");
  };

  const openEdit = (c: Client) => {
    setForm({
      client_code: c.client_code || "",
      name: c.name,
      phone: c.phone || "",
      owner_name: c.owner_name || "",
      outdoor_photo: c.outdoor_photo || "",
      indoor_photo: c.indoor_photo || "",
      district: c.district || "",
      subdistrict: c.subdistrict || "",
      neighborhood: c.neighborhood || "",
      building_door: c.building_door || "",
      status: c.status || "",
    });
    setEditId(c.id);
    setError("");
    setOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const set = (key: keyof ClientInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value || null }));

  const handleSubmit = async () => {
    setError("");
    if (!form.name?.trim()) {
      setError("Нэр шаардлагатай");
      return;
    }
    try {
      if (editId) {
        await updateClient(editId, form);
      } else {
        await createClient({ ...form, name: form.name.trim() });
      }
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const handlePhotoUpload = async (
    field: "outdoor_photo" | "indoor_photo",
    file: File,
  ) => {
    setUploading(field);
    setError("");
    try {
      const result = await uploadFile(file);
      setForm((prev) => ({ ...prev, [field]: String(result.id) }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Зураг хуулахад алдаа гарлаа",
      );
    } finally {
      setUploading(null);
    }
  };

  const clearPhoto = (field: "outdoor_photo" | "indoor_photo") => {
    setForm((prev) => ({ ...prev, [field]: null }));
  };

  const handleDelete = async (id: number, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const exportExcel = () => {
    const headers = [
      "Код",
      "Нэр",
      "Утас",
      "Эзэмшигч",
      "Дүүрэг",
      "Хороо",
      "Хороолол",
      "Барилга, хаалга",
      "Төлөв",
      "Бүртгэгдсэн",
    ];
    const body = filteredClients.map((c) => [
      c.client_code || "",
      c.name,
      c.phone || "",
      c.owner_name || "",
      c.district || "",
      c.subdistrict || "",
      c.neighborhood || "",
      c.building_door || "",
      c.status === "active"
        ? "Идэвхтэй"
        : c.status === "inactive"
          ? "Идэвхгүй"
          : "",
      c.created_at?.slice(0, 10) || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Харилцагчид");
    XLSX.writeFile(
      wb,
      `clients_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "client_code",
      header: "Код",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{String(getValue() ?? "-")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Нэр",
      cell: ({ getValue }) => (
        <span className="font-medium">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Утас",
      cell: ({ getValue }) => String(getValue() ?? "-"),
    },
    {
      accessorKey: "owner_name",
      header: "Эзэмшигч",
      cell: ({ getValue }) => String(getValue() ?? "-"),
    },
    {
      accessorKey: "district",
      header: "Дүүрэг",
      cell: ({ getValue }) => String(getValue() ?? "-"),
    },
    {
      accessorKey: "status",
      header: "Төлөв",
      cell: ({ getValue }) => {
        const v = getValue();
        if (v === "active")
          return (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Идэвхтэй
            </span>
          );
        if (v === "inactive")
          return (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Идэвхгүй
            </span>
          );
        return "-";
      },
    },
    {
      id: "outdoor_photo",
      header: "Гадна зураг",
      cell: ({ row }) => {
        const val = row.original.outdoor_photo;
        return val ? (
          <img
            src={getFileUrl(val) || ""}
            alt="Гадна"
            className="h-10 w-10 cursor-pointer rounded border object-cover hover:opacity-80"
            onClick={() => setPreviewUrl(getFileUrl(val))}
          />
        ) : (
          "-"
        );
      },
    },
    {
      id: "indoor_photo",
      header: "Дотор зураг",
      cell: ({ row }) => {
        const val = row.original.indoor_photo;
        return val ? (
          <img
            src={getFileUrl(val) || ""}
            alt="Дотор"
            className="h-10 w-10 cursor-pointer rounded border object-cover hover:opacity-80"
            onClick={() => setPreviewUrl(getFileUrl(val))}
          />
        ) : (
          "-"
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Огноо",
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? new Date(v).toLocaleDateString("mn-MN") : "-";
      },
    },
    {
      id: "actions",
      header: "Үйлдэл",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => openEdit(row.original)}
          >
            Засах
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="xs"
              className="text-destructive"
              onClick={() => handleDelete(row.original.id, row.original.name)}
            >
              Устгах
            </Button>
          )}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: filteredClients,
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
        <h1 className="text-2xl font-semibold">Харилцагчид</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            Excel экспорт
          </Button>
          <Button onClick={openCreate}>Шинэ харилцагч</Button>
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
        <input
          placeholder="Утасаар хайх..."
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
      </div>

      <Separator className="mb-4" />

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
            <DialogTitle>
              {editId ? "Харилцагч засах" : "Шинэ харилцагч"}
            </DialogTitle>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Үндсэн мэдээлэл
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Код"
                    value={form.client_code || ""}
                    onChange={(e) => set("client_code", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <input
                    placeholder="Нэр *"
                    value={form.name || ""}
                    onChange={(e) => set("name", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <input
                    placeholder="Утас"
                    value={form.phone || ""}
                    onChange={(e) => set("phone", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <input
                    placeholder="Эзэмшигчийн нэр"
                    value={form.owner_name || ""}
                    onChange={(e) => set("owner_name", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <select
                    value={form.status || ""}
                    onChange={(e) => set("status", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 bg-background"
                  >
                    <option value="">Төлөв сонгох</option>
                    <option value="active">Идэвхтэй</option>
                    <option value="inactive">Идэвхгүй</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Зураг
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <PhotoUploadField
                    label="Гадна зураг"
                    value={form.outdoor_photo as string | null | undefined}
                    uploading={uploading === "outdoor_photo"}
                    onUpload={(f) => handlePhotoUpload("outdoor_photo", f)}
                    onClear={() => clearPhoto("outdoor_photo")}
                  />
                  <PhotoUploadField
                    label="Дотор зураг"
                    value={form.indoor_photo as string | null | undefined}
                    uploading={uploading === "indoor_photo"}
                    onUpload={(f) => handlePhotoUpload("indoor_photo", f)}
                    onClear={() => clearPhoto("indoor_photo")}
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Байршил
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    placeholder="Дүүрэг"
                    value={form.district || ""}
                    onChange={(e) => set("district", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <input
                    placeholder="Хороо"
                    value={form.subdistrict || ""}
                    onChange={(e) => set("subdistrict", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <input
                    placeholder="Хороолол"
                    value={form.neighborhood || ""}
                    onChange={(e) => set("neighborhood", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                  <input
                    placeholder="Барилга, хаалга"
                    value={form.building_door || ""}
                    onChange={(e) => set("building_door", e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                  />
                </div>
              </div>
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
                  Одоогоор харилцагч байхгүй
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
        <span>Нийт: {filteredClients.length} мөр</span>
        <span>
          {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            filteredClients.length,
          )}{" "}
          / {filteredClients.length}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Харилцагч устгах"
        message={`"${deleteTarget?.name ?? ""}"-г устгах уу?`}
        onConfirm={confirmDelete}
      />

      {previewUrl && (
        <Dialog
          open={true}
          onOpenChange={(v) => {
            if (!v) setPreviewUrl(null);
          }}
        >
          <DialogPortal>
            <DialogBackdrop />
            <DialogPopup className="max-h-[90vh] max-w-[90vw] overflow-auto p-2 sm:max-w-3xl">
              <img
                src={previewUrl}
                alt="Зураг"
                className="h-auto w-full rounded"
              />
              <DialogClose
                render={
                  <Button variant="outline" size="sm" className="mt-2 w-full">
                    Хаах
                  </Button>
                }
              />
            </DialogPopup>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  );
}

function PhotoUploadField({
  label,
  value,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  value: string | null | undefined;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const imgUrl = getFileUrl(value);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onUpload(f);
            e.target.value = "";
          }
        }}
      />
      <div className="flex items-center gap-3">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={label}
            className="h-14 w-14 shrink-0 rounded-lg border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
            Зураггүй
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={uploading}
            onClick={() => ref.current?.click()}
          >
            {uploading ? "Хуулж байна..." : value ? "Солих" : "Хуулах"}
          </Button>
          {value && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="text-destructive"
              onClick={onClear}
            >
              Устгах
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientsPage;
