import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getPaginationRowModel,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { DatePicker } from "@/components/ui/date-picker";
import { ClientSelect } from "@/components/ui/client-select";
import {
  Popover,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverPopup,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { cn, getPageNumbers, formatDateLocal } from "@/lib/utils";
import {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  getProductsAll,
  getClientsAll,
  getBankAccounts,
  type Sale,
  type Product,
  type Client,
  type BankAccount,
} from "@/lib/api";

interface LineItemForm {
  product_code: string;
  product_name: string;
  amount: number;
  unit_price: number;
}

interface BankAllocForm {
  bank_account_id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  amount: number;
}

const emptyLine = (): LineItemForm => ({
  product_code: "",
  product_name: "",
  amount: 1,
  unit_price: 0,
});

function ProductSelect({
  value,
  onSelect,
  products,
}: {
  value: string;
  onSelect: (code: string, name: string) => void;
  products: { code: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  const selected = products.find((p) => p.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <div
          role="combobox"
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center rounded border px-2 py-1.5 text-xs outline-none focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50"
        >
          <span className={cn("flex-1", !value && "text-muted-foreground")}>
            {selected ? selected.code : "Код"}
          </span>
          <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
        </div>
      } />
      <PopoverPortal>
        <PopoverPositioner align="start" className="min-w-60">
          <PopoverPopup className="p-0">
            <Command>
              <CommandInput placeholder="Бараа хайх..." />
              <CommandList>
                <CommandEmpty>Бараа олдсонгүй</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => {
                    const cmdValue = `${p.code} ${p.name}`;
                    return (
                      <CommandItem
                        key={p.code}
                        value={cmdValue}
                        onSelect={() => {
                          onSelect(p.code, p.name);
                          setOpen(false);
                        }}
                      >
                        <CheckIcon
                          className={cn(
                            "mr-2 size-4",
                            p.code === value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="font-medium text-muted-foreground shrink-0">{p.code}</span>
                        <span className="ml-2 truncate">{p.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}

function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sale_date", desc: true },
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // dialog form state
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saleDate, setSaleDate] = useState(new Date());
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [slipNumber, setSlipNumber] = useState("");
  const [items, setItems] = useState<LineItemForm[]>(
    Array.from({ length: 5 }, () => emptyLine()),
  );
  const [cashAmount, setCashAmount] = useState(0);
  const [deferredAmount, setDeferredAmount] = useState(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [allocations, setAllocations] = useState<BankAllocForm[]>([]);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [searchClientName, setSearchClientName] = useState("");
  const [searchSlipNumber, setSearchSlipNumber] = useState("");
  const [searchTotalMin, setSearchTotalMin] = useState("");
  const [searchTotalMax, setSearchTotalMax] = useState("");
  const isAdmin = JSON.parse(localStorage.getItem("user") || "{}").is_admin;
  const currentUserId = JSON.parse(localStorage.getItem("user") || "{}").id;
  const perPage = 50;

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await getSales({
          client_name: searchClientName,
          slip_number: searchSlipNumber,
          total_min: searchTotalMin || undefined,
          total_max: searchTotalMax || undefined,
          page: p,
          per_page: perPage,
        });
        setSales(res.data);
        setTotal(res.total);
        setPage(res.page);
      } catch {
        /* ignore */
      }
      setLoading(false);
    },
    [searchClientName, searchSlipNumber, searchTotalMin, searchTotalMax],
  );

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [
    searchClientName,
    searchSlipNumber,
    searchTotalMin,
    searchTotalMax,
    load,
  ]);

  // Load reference data once on mount
  useEffect(() => {
    (async () => {
      try {
        const [p, c, b] = await Promise.all([
          getProductsAll(),
          getClientsAll(),
          getBankAccounts(),
        ]);
        setProducts(p);
        setClients(c);
        setBankAccounts(b);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const resetForm = () => {
    setSaleDate(new Date());
    setClientCode("");
    setClientName("");
    setClientPhone("");
    setSlipNumber("");
    setItems(Array.from({ length: 5 }, () => emptyLine()));
    setCashAmount(0);
    setDeferredAmount(0);
    setDiscountEnabled(false);
    setDiscountAmount(0);
    setAllocations([]);
    setEditId(null);
    setError("");
  };

  const openEdit = async (s: Sale) => {
    try {
      const full = await getSale(s.id);
      setSaleDate(new Date(full.sale_date));
      setClientCode(full.client_code || "");
      setClientName(full.client_name || "");
      setClientPhone(full.client_phone || "");
      setSlipNumber(full.slip_number || "");
      setCashAmount(full.cash_amount);
      setDeferredAmount(full.deferred_amount);
      setDiscountAmount(full.discount_amount ?? 0);
      setDiscountEnabled((full.discount_amount ?? 0) > 0);
      setItems(
        full.items.map((i) => ({
          product_code: i.product_code,
          product_name: i.product_name,
          amount: i.amount,
          unit_price: i.unit_price,
        })),
      );
      setAllocations(
        (full.bank_allocations || []).map((a) => ({
          bank_account_id: a.bank_account_id,
          bank_name: a.bank_name,
          account_number: a.account_number,
          account_name: a.account_name,
          amount: a.amount,
        })),
      );
      setEditId(s.id);
      setError("");
      setOpen(true);
    } catch {
      setError("Борлуулалт уншихад алдаа гарлаа");
    }
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const addItem = () => setItems((prev) => [...prev, emptyLine()]);

  const removeItem = (idx: number) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  };

  const updateItem = (
    idx: number,
    field: keyof LineItemForm,
    value: string | number,
  ) => {
    setItems((prev) => {
      const next = prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      );

      if (field === "product_code") {
        const code = String(value);
        const match = products.find((p) => p.code === code);
        if (match) next[idx].product_name = match.name;
      }

      return next;
    });
  };

  const updateAllocation = (idx: number, value: number) => {
    setAllocations((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], amount: value };
      return next;
    });
  };

  const totalSum = useMemo(
    () => items.reduce((sum, item) => sum + item.amount * item.unit_price, 0),
    [items],
  );

  const allocTotal = useMemo(
    () =>
      (cashAmount || 0) +
      (deferredAmount || 0) +
      allocations.reduce((sum, a) => sum + (a.amount || 0), 0),
    [cashAmount, deferredAmount, allocations],
  );

  const dateStr = useMemo(() => {
    try {
      return formatDateLocal(saleDate);
    } catch {
      return formatDateLocal(new Date());
    }
  }, [saleDate]);

  const save = async (status: string) => {
    setError("");
    if (!slipNumber.trim()) {
      setError("Падааны дугаар шаардлагатай");
      return;
    }
    if (items.length === 0 || items.every((i) => !i.product_code.trim())) {
      setError("Дор хаяж нэг бараа оруулна уу");
      return;
    }
    if (status === "final" && allocTotal < totalSum - discountAmount) {
      setError("Хуваарилалтын дүн нийт дүнгээс бага байна");
      return;
    }
    try {
      const payload = {
        sale_date: dateStr,
        client_code: clientCode || null,
        client_name: clientName || null,
        client_phone: clientPhone || null,
        slip_number: slipNumber.trim(),
        status,
        cash_amount: cashAmount || 0,
        deferred_amount: deferredAmount || 0,
        discount_amount: discountEnabled ? discountAmount || 0 : 0,
        items: items
          .filter((i) => i.product_code.trim())
          .map((i) => ({
            product_code: i.product_code,
            product_name: i.product_name,
            amount: i.amount,
            unit_price: i.unit_price,
          })),
        bank_allocations: allocations
          .filter((a) => a.amount > 0)
          .map((a) => ({
            bank_account_id: a.bank_account_id,
            bank_name: a.bank_name,
            account_number: a.account_number,
            account_name: a.account_name,
            amount: a.amount,
          })),
      };
      if (editId) {
        await updateSale(editId, payload);
      } else {
        await createSale(payload);
      }
      resetForm();
      setOpen(false);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget({ id, name: `Борлуулалт #${id}` });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSale(deleteTarget.id);
      setDeleteTarget(null);
      await load(page);
    } catch (err) {
      setDeleteTarget(null);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const handleClientSelect = (c: {
    client_code: string;
    client_name: string;
    client_phone: string;
  }) => {
    setClientCode(c.client_code);
    setClientName(c.client_name);
    setClientPhone(c.client_phone);
  };

  const columns: ColumnDef<Sale>[] = [
    {
      id: "sale_date",
      header: "Огноо",
      accessorKey: "sale_date",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString("mn-MN") : "-";
      },
    },
    {
      id: "client_name",
      header: "Харилцагч",
      cell: ({ row }) =>
        row.original.client_name || row.original.client_code || "-",
    },
    {
      id: "slip_number",
      header: "Падааны дугаар",
      accessorKey: "slip_number",
      cell: ({ getValue }) => String(getValue() ?? "-"),
    },
    {
      id: "status",
      header: "Төлөв",
      accessorKey: "status",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (v === "draft")
          return (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              Түр хадгалсан
            </span>
          );
        return (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Баталгаажсан
          </span>
        );
      },
    },
    {
      id: "total_amount",
      header: "Дүн",
      accessorKey: "total_amount",
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return v.toLocaleString("mn-MN") + " ₮";
      },
    },
    {
      id: "items_count",
      header: "Мөр",
      cell: ({ row }) =>
        row.original.items_count ?? row.original.items?.length ?? "-",
    },
    {
      id: "user_name",
      header: "Бүртгэсэн",
      accessorKey: "user_name",
      cell: ({ getValue }) => String(getValue() ?? "-"),
    },
    {
      id: "actions",
      header: "Үйлдэл",
      cell: ({ row }) => (
        <div className="flex gap-1">
          {(isAdmin || row.original.user_id === currentUserId) &&
            (row.original.is_locked && !isAdmin ? (
              <span className="text-xs text-muted-foreground px-2">
                Түгжигдсэн
              </span>
            ) : (
              <Button
                variant="outline"
                size="xs"
                onClick={() => openEdit(row.original)}
              >
                Засах
              </Button>
            ))}
          {isAdmin && (
            <Button
              variant="outline"
              size="xs"
              className="text-destructive"
              onClick={() => handleDelete(row.original.id)}
            >
              Устгах
            </Button>
          )}
        </div>
      ),
    },
  ];

  const pageCount = Math.ceil(total / perPage);

  const table = useReactTable({
    data: sales,
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
        <h1 className="text-2xl font-semibold">Борлуулалт</h1>
        <Button onClick={openCreate}>Шинэ борлуулалт</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Харилцагчийн нэр..."
          value={searchClientName}
          onChange={(e) => setSearchClientName(e.target.value)}
          className="min-w-40 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
        <input
          placeholder="Падааны дугаар..."
          value={searchSlipNumber}
          onChange={(e) => setSearchSlipNumber(e.target.value)}
          className="min-w-40 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
        <input
          placeholder="Дүн (доод)..."
          value={searchTotalMin}
          onChange={(e) => setSearchTotalMin(e.target.value)}
          className="w-32 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
        <input
          placeholder="Дүн (дээд)..."
          value={searchTotalMax}
          onChange={(e) => setSearchTotalMax(e.target.value)}
          className="w-32 rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
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
          <DialogPopup className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogTitle>
              {editId ? "Борлуулалт засах" : "Шинэ борлуулалт"}
            </DialogTitle>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Огноо
                </p>
                <DatePicker
                  value={saleDate}
                  onChange={(d) => d && setSaleDate(d)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Падааны дугаар
                </p>
                <input
                  placeholder="Падааны №"
                  value={slipNumber}
                  onChange={(e) => setSlipNumber(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Харилцагч
                </p>
                <ClientSelect
                  clients={clients}
                  selectedCode={clientCode}
                  selectedName={clientName}
                  selectedPhone={clientPhone}
                  onSelect={handleClientSelect}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Бараанууд</p>
                <Button size="xs" variant="outline" onClick={addItem}>
                  + Мөр нэмэх
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium w-1/6">
                        Барааны код
                      </th>
                      <th className="px-2 py-2 font-medium w-3/6">
                        Барааны нэр
                      </th>
                      <th className="px-2 py-2 font-medium text-right">
                        Ширхэг
                      </th>
                      <th className="px-2 py-2 font-medium text-right">Үнэ</th>
                      <th className="px-2 py-2 font-medium text-right">Нийт</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1.5 w-1/6 min-w-40">
                          <ProductSelect
                            value={item.product_code}
                            onSelect={(code, name) => {
                              setItems((prev) => {
                                const next = prev.map((it, i) =>
                                  i === idx ? { ...it, product_code: code, product_name: name } : it,
                                );
                                return next;
                              });
                            }}
                            products={products}
                          />
                        </td>
                        <td className="px-2 py-1.5 w-3/6">
                          <input
                            placeholder="Нэр"
                            value={item.product_name}
                            onChange={(e) =>
                              updateItem(idx, "product_name", e.target.value)
                            }
                            className="w-full rounded border px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.amount}
                            onChange={(e) =>
                              updateItem(idx, "amount", Number(e.target.value))
                            }
                            className="w-full min-w-12 max-w-24 rounded border px-2 py-1.5 text-right text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                "unit_price",
                                Number(e.target.value),
                              )
                            }
                            className="w-full min-w-16 max-w-28 rounded border px-2 py-1.5 text-right text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                          {(item.amount * item.unit_price).toLocaleString(
                            "mn-MN",
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => removeItem(idx)}
                            className="rounded px-1 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end border-t pt-3">
                <div className="text-sm font-semibold tabular-nums">
                  Нийт дүн: {totalSum.toLocaleString("mn-MN")} ₮
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Төлбөрийн хэлбэр</p>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="discount-switch"
                    className="text-sm font-medium cursor-pointer select-none"
                  >
                    Хөнгөлөлт
                  </label>
                  <Switch
                    id="discount-switch"
                    checked={discountEnabled}
                    onCheckedChange={setDiscountEnabled}
                  />
                </div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Нийт дүнг төлбөрийн хэлбэрүүдээр хуваарилах
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">Бэлэн</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(Number(e.target.value))}
                      className="w-28 rounded border px-2 py-1 text-right text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">₮</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">Дараа төлбөр</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={deferredAmount}
                      onChange={(e) =>
                        setDeferredAmount(Number(e.target.value))
                      }
                      className="w-28 rounded border px-2 py-1 text-right text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">₮</span>
                  </div>
                </div>
                <div
                  className={`flex items-center justify-between rounded-lg border px-3 py-1.5 ${discountEnabled ? "border-green-200 bg-green-50" : "border-muted bg-muted/30"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${discountEnabled ? "" : "text-muted-foreground"}`}
                    >
                      Хөнгөлөлт
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={discountAmount}
                      disabled={!discountEnabled}
                      onChange={(e) =>
                        setDiscountAmount(Number(e.target.value))
                      }
                      className="w-28 rounded border px-2 py-1 text-right text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 tabular-nums disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="text-xs text-muted-foreground">₮</span>
                  </div>
                </div>
                {bankAccounts.map((ba) => {
                  const alloc = allocations.find(
                    (a) => a.bank_account_id === ba.id,
                  );
                  return (
                    <div
                      key={ba.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-1.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {ba.account_name || ba.bank_name}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({ba.bank_name}, {ba.account_number})
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={alloc?.amount ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (alloc) {
                              updateAllocation(allocations.indexOf(alloc), val);
                            } else {
                              setAllocations((prev) => [
                                ...prev,
                                {
                                  bank_account_id: ba.id,
                                  bank_name: ba.bank_name,
                                  account_number: ba.account_number,
                                  account_name: ba.account_name,
                                  amount: val,
                                },
                              ]);
                            }
                          }}
                          className="w-28 rounded border px-2 py-1.5 text-right text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50 tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground">₮</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end border-t pt-3">
                <div
                  className={`text-sm font-semibold tabular-nums ${allocTotal < totalSum - discountAmount ? "text-destructive" : ""}`}
                >
                  Хуваарилалт: {allocTotal.toLocaleString("mn-MN")} ₮
                  {discountAmount > 0 && (
                    <span className="ml-2 text-xs font-normal text-green-600">
                      (хөнгөлөлт: {discountAmount.toLocaleString("mn-MN")} ₮)
                    </span>
                  )}
                  {allocTotal < totalSum - discountAmount && (
                    <span className="ml-2 text-xs font-normal">
                      (
                      {(totalSum - discountAmount - allocTotal).toLocaleString(
                        "mn-MN",
                      )}{" "}
                      ₮ дутуу)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => save("draft")}
              >
                Түр хадгалах
              </Button>
              <Button className="flex-1" onClick={() => save("final")}>
                {editId ? "Хадгалах" : "Бүртгэх"}
              </Button>
              <DialogClose render={<Button variant="outline">Цуцлах</Button>} />
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
                  Одоогоор борлуулалт байхгүй
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
          {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} / {total}
        </span>
      </div>

      {pageCount > 1 && (
        <Pagination className="mt-2">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => goPage(page - 1)}
                className={
                  page <= 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
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
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => goPage(page + 1)}
                className={
                  page >= pageCount
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
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
        title="Борлуулалт устгах"
        message={`${deleteTarget?.name ?? ""}-г устгах уу?`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default SalesPage;
