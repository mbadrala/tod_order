import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { ClientSelect } from "@/components/ui/client-select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  listReports,
  listReportsAll,
  deleteReport,
  getBankAccounts,
  getClientsAll,
  getUsers,
  type BankAccount,
  type Client,
  type Report,
} from "@/lib/api";
import * as XLSX from "xlsx";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getPageNumbers } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function getTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

const isAdmin = () => getTokenPayload()?.is_admin ?? false;

function buildExportName(
  from?: Date,
  to?: Date,
  clientCode?: string,
  clientName?: string,
): string {
  const parts: string[] = ["tailan_export"];
  if (from) parts.push("from_" + from.toISOString().slice(0, 10));
  if (to) parts.push("to_" + to.toISOString().slice(0, 10));
  if (clientCode) {
    const label = clientName ? `${clientName}_${clientCode}` : clientCode;
    parts.push(label.replace(/[^a-zA-Z0-9_\-\u0400-\u04ff]/g, "_"));
  }
  return parts.join("_");
}

interface FlatRow {
  sale_id: number;
  sale_date: string;
  client_code: string;
  client_name: string;
  client_phone: string;
  slip_number: string;
  product_code: string;
  product_name: string;
  amount: number;
  unit_price: number;
  sum_price: number;
  cash_amount: number;
  deferred_amount: number;
  discount_amount: number;
  user_name: string;
  created_at: string;
  bankAllocs: Record<string, number>;
}

function ReportsPage() {
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [unitPriceMin, setUnitPriceMin] = useState("");
  const [unitPriceMax, setUnitPriceMax] = useState("");
  const [sumPriceMin, setSumPriceMin] = useState("");
  const [sumPriceMax, setSumPriceMax] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [data, setData] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    sale_id: number;
    name: string;
  } | null>(null);

  const loadMeta = async () => {
    try {
      const [c, b] = await Promise.all([getClientsAll(), getBankAccounts()]);
      setClients(c);
      setBankAccounts(b);
      if (isAdmin()) {
        const u = await getUsers();
        setUsers(u);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const perPage = 100;

  const fetchReport = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const filters: Record<string, any> = { page, per_page: perPage };
      if (fromDate) filters.from = fromDate.toISOString().slice(0, 10);
      if (toDate) filters.to = toDate.toISOString().slice(0, 10);
      if (clientCode.trim()) filters.client_code = clientCode.trim();
      if (productCode.trim()) filters.product_code = productCode.trim();
      if (productName.trim()) filters.product_name = productName.trim();
      if (amountMin) filters.amount_min = Number(amountMin);
      if (amountMax) filters.amount_max = Number(amountMax);
      if (unitPriceMin) filters.unit_price_min = Number(unitPriceMin);
      if (unitPriceMax) filters.unit_price_max = Number(unitPriceMax);
      if (sumPriceMin) filters.sum_price_min = Number(sumPriceMin);
      if (sumPriceMax) filters.sum_price_max = Number(sumPriceMax);
      if (bankAccountId) filters.bank_account_id = Number(bankAccountId);
      if (filterUserId) filters.user_id = Number(filterUserId);

      const result = await listReports(filters);
      setData(result.data);
      setTotal(result.total);
      setCurrentPage(result.page);
    } catch {
      setData([]);
      setTotal(0);
    }
    setLoading(false);
  }, [
    fromDate,
    toDate,
    clientCode,
    productCode,
    productName,
    amountMin,
    amountMax,
    unitPriceMin,
    unitPriceMax,
    sumPriceMin,
    sumPriceMax,
    bankAccountId,
    filterUserId,
  ]);

  useEffect(() => {
    fetchReport(1);
  }, [fetchReport]);

  const handleClientSelect = (c: {
    client_code: string;
    client_name: string;
    client_phone: string;
  }) => {
    setClientCode(c.client_code);
    setClientName(c.client_name);
  };

  const clearClient = () => {
    setClientCode("");
    setClientName("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReport(deleteTarget.sale_id);
      setDeleteTarget(null);
      await fetchReport(currentPage);
    } catch {
      setDeleteTarget(null);
    }
  };

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const r of data) {
      const bankByAccountId: Record<string, number> = {};
      for (const a of r.bank_allocations || []) {
        bankByAccountId[String(a.bank_account_id)] = a.amount;
      }
      rows.push({
        sale_id: r.sale_id,
        sale_date: r.sale_date,
        client_code: r.client_code || "",
        client_name: r.client_name || "",
        client_phone: r.client_phone || "",
        slip_number: r.slip_number || "",
        product_code: r.product_code,
        product_name: r.product_name,
        amount: r.item_amount,
        unit_price: r.unit_price,
        sum_price: r.sum_price,
        cash_amount: r.cash_amount,
        deferred_amount: r.deferred_amount,
        discount_amount: r.discount_amount ?? 0,
        user_name: r.user_name,
        created_at: r.created_at,
        bankAllocs: { ...bankByAccountId },
      });
    }
    return rows;
  }, [data]);

  const pageSpanMap = useMemo(() => {
    const map = new Map<number, { count: number; seen: boolean }>();
    for (const r of flatRows) {
      const entry = map.get(r.sale_id) || { count: 0, seen: false };
      entry.count++;
      map.set(r.sale_id, entry);
    }
    return map;
  }, [flatRows]);

  const pageCount = Math.ceil(total / perPage);

  const goPage = (p: number) => {
    setCurrentPage(p);
    fetchReport(p);
  };

  const exportName = useMemo(
    () =>
      buildExportName(
        fromDate,
        toDate,
        clientCode || undefined,
        clientName || undefined,
      ),
    [fromDate, toDate, clientCode, clientName],
  );

  const exportPdf = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate.toISOString().slice(0, 10));
    if (toDate) params.set("to", toDate.toISOString().slice(0, 10));
    if (clientCode.trim()) params.set("client_code", clientCode.trim());
    if (productCode.trim()) params.set("product_code", productCode.trim());
    if (productName.trim()) params.set("product_name", productName.trim());
    if (amountMin) params.set("amount_min", amountMin);
    if (amountMax) params.set("amount_max", amountMax);
    if (unitPriceMin) params.set("unit_price_min", unitPriceMin);
    if (unitPriceMax) params.set("unit_price_max", unitPriceMax);
    if (sumPriceMin) params.set("sum_price_min", sumPriceMin);
    if (sumPriceMax) params.set("sum_price_max", sumPriceMax);
    if (bankAccountId) params.set("bank_account_id", bankAccountId);
    if (filterUserId) params.set("user_id", filterUserId);
    const token = localStorage.getItem("token");
    const url = `${API_BASE}/sales/report/pdf?${params}&token=${encodeURIComponent(token || "")}`;
    window.open(url, "_blank");
  };

  const exportExcel = async () => {
    const filters: Record<string, any> = {};
    if (fromDate) filters.from = fromDate.toISOString().slice(0, 10);
    if (toDate) filters.to = toDate.toISOString().slice(0, 10);
    if (clientCode.trim()) filters.client_code = clientCode.trim();
    if (productCode.trim()) filters.product_code = productCode.trim();
    if (productName.trim()) filters.product_name = productName.trim();
    if (amountMin) filters.amount_min = Number(amountMin);
    if (amountMax) filters.amount_max = Number(amountMax);
    if (unitPriceMin) filters.unit_price_min = Number(unitPriceMin);
    if (unitPriceMax) filters.unit_price_max = Number(unitPriceMax);
    if (sumPriceMin) filters.sum_price_min = Number(sumPriceMin);
    if (sumPriceMax) filters.sum_price_max = Number(sumPriceMax);
    if (bankAccountId) filters.bank_account_id = Number(bankAccountId);
    if (filterUserId) filters.user_id = Number(filterUserId);
    const allData = await listReportsAll(filters);
    const allRows: FlatRow[] = allData.map((r) => {
      const bankByAccountId: Record<string, number> = {};
      for (const a of r.bank_allocations || []) {
        bankByAccountId[String(a.bank_account_id)] = a.amount;
      }
      return {
        sale_id: r.sale_id,
        sale_date: r.sale_date,
        client_code: r.client_code || "",
        client_name: r.client_name || "",
        client_phone: r.client_phone || "",
        slip_number: r.slip_number || "",
        product_code: r.product_code,
        product_name: r.product_name,
        amount: r.item_amount,
        unit_price: r.unit_price,
        sum_price: r.sum_price,
        cash_amount: r.cash_amount,
        deferred_amount: r.deferred_amount,
        discount_amount: r.discount_amount ?? 0,
        user_name: r.user_name,
        created_at: r.created_at,
        bankAllocs: { ...bankByAccountId },
      };
    });
    const sorted = allRows.sort((a, b) => b.sale_id - a.sale_id);
    const headers = [
      "Огноо",
      "Харилцагчийн код",
      "Харилцагчийн нэр",
      "Утасны дугаар",
      "Падааны дугаар",
      "Барааны код",
      "Барааны нэр",
      "Тоо хэмжээ",
      "Нэгж үнэ",
      "Дүн",
      "Бэлэн",
      ...bankAccounts.map(
        (ba) => ba.account_name ? `${ba.bank_name} (${ba.account_name})` : ba.bank_name,
      ),
      "Дараа төлбөр",
      "Хөнгөлөлт",
      "Бүртгэсэн ажилтан",
      "Бүртгэсэн огноо",
    ];
    const bankAllocStart = 11;
    const bankAllocEnd = bankAllocStart + bankAccounts.length - 1;
    const deferredCol = bankAllocStart + bankAccounts.length;
    const discountCol = deferredCol + 1;
    const userCol = discountCol + 1;
    const createdAtCol = userCol + 1;
    const saleLevelCols = [0, 1, 2, 3, 4, 10];
    for (let c = bankAllocStart; c <= bankAllocEnd; c++) saleLevelCols.push(c);
    saleLevelCols.push(deferredCol, discountCol, userCol, createdAtCol);

    const body: any[][] = [];
    const merges: XLSX.Range[] = [];
    let rowIdx = 0;
    while (rowIdx < sorted.length) {
      const saleId = sorted[rowIdx].sale_id;
      let nextIdx = rowIdx + 1;
      while (nextIdx < sorted.length && sorted[nextIdx].sale_id === saleId)
        nextIdx++;
      for (let i = rowIdx; i < nextIdx; i++) {
        const r = sorted[i];
        const row = [
          r.sale_date,
          r.client_code,
          r.client_name,
          r.client_phone,
          r.slip_number,
          r.product_code,
          r.product_name,
          r.amount,
          r.unit_price,
          r.sum_price,
          r.cash_amount,
          ...bankAccounts.map((ba) => r.bankAllocs[String(ba.id)] || 0),
          r.deferred_amount,
          r.discount_amount,
          r.user_name,
          r.created_at,
        ];
        if (i > rowIdx) {
          for (const col of saleLevelCols) row[col] = "";
        }
        body.push(row);
      }
      const count = nextIdx - rowIdx;
      if (count > 1) {
        const startRow = body.length - count + 1;
        const endRow = body.length;
        for (const col of saleLevelCols) {
          merges.push({ s: { r: startRow, c: col }, e: { r: endRow, c: col } });
        }
      }
      rowIdx = nextIdx;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    ws["!merges"] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Тайлан");
    XLSX.writeFile(wb, `${exportName}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Тайлан</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportPdf}
            disabled={flatRows.length === 0}
          >
            PDF экспорт
          </Button>
          <Button
            variant="outline"
            onClick={exportExcel}
            disabled={flatRows.length === 0}
          >
            Excel экспорт
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Эхлэх огноо
          </p>
          <DatePicker
            value={fromDate}
            onChange={(d) => setFromDate(d ?? undefined)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Дуусах огноо
          </p>
          <DatePicker
            value={toDate}
            onChange={(d) => setToDate(d ?? undefined)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Харилцагч
          </p>
          <div className="flex gap-1">
            <div className="min-w-60">
              <ClientSelect
                clients={clients}
                selectedCode={clientCode}
                selectedName={clientName}
                selectedPhone=""
                onSelect={handleClientSelect}
              />
            </div>
            {clientCode && (
              <Button variant="ghost" size="xs" onClick={clearClient}>
                ✕
              </Button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Барааны код
          </p>
          <input
            className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Барааны код"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Барааны нэр
          </p>
          <input
            className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Барааны нэр"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Тоо хэмжээ (доод)
          </p>
          <input
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="доод"
            type="number"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Тоо хэмжээ (дээд)
          </p>
          <input
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="дээд"
            type="number"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Нэгж үнэ (доод)
          </p>
          <input
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="доод"
            type="number"
            value={unitPriceMin}
            onChange={(e) => setUnitPriceMin(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Нэгж үнэ (дээд)
          </p>
          <input
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="дээд"
            type="number"
            value={unitPriceMax}
            onChange={(e) => setUnitPriceMax(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Дүн (доод)
          </p>
          <input
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="доод"
            type="number"
            value={sumPriceMin}
            onChange={(e) => setSumPriceMin(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Дүн (дээд)
          </p>
          <input
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="дээд"
            type="number"
            value={sumPriceMax}
            onChange={(e) => setSumPriceMax(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Банкны данс
          </p>
          <select
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
          >
            <option value="">Бүгд</option>
            {bankAccounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.account_name || ba.bank_name} - {ba.account_number}
              </option>
            ))}
          </select>
        </div>
        {isAdmin() && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Ажилтан
            </p>
            <select
              className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
            >
              <option value="">Бүгд</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button variant="default" onClick={() => fetchReport(1)}>
          Хайх
        </Button>
      </div>

      <Separator className="mb-4" />

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Уншиж байна...</p>
      ) : flatRows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Илэрц олдсонгүй
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                <th className="whitespace-nowrap px-2 py-2 font-medium">
                  Огноо
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">
                  Харилцагчийн код
                </th>
                <th className="px-2 py-2 font-medium">
                  Харилцагчийн нэр
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">
                  Утасны дугаар
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">
                  Падааны дугаар
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">
                  Барааны код
                </th>
                <th className="px-2 py-2 font-medium">
                  Барааны нэр
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">
                  Тоо хэмжээ
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">
                  Нэгж үнэ
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">
                  Дүн
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">
                  Бэлэн
                </th>
                {bankAccounts.map((ba) => (
                  <th
                    key={ba.id}
                    className="whitespace-nowrap px-2 py-2 font-medium text-center"
                    title={`${ba.bank_name} - ${ba.account_number}`}
                  >
                    <div className="flex flex-col items-center">
                      <span>{ba.bank_name}</span>
                      {ba.account_name && <span className="text-muted-foreground">({ba.account_name})</span>}
                    </div>
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">
                  Дараа төлбөр
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">
                  Хөнгөлөлт
                </th>
                <th className="px-2 py-2 font-medium">
                  Бүртгэсэн ажилтан
                </th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">
                  Бүртгэсэн огноо
                </th>
                {isAdmin() && (
                  <th className="whitespace-nowrap px-2 py-2 font-medium">
                    Үйлдэл
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const seenSaleIds = new Set<number>();
                return flatRows.map((r) => {
                  const isFirst = !seenSaleIds.has(r.sale_id);
                  if (isFirst) seenSaleIds.add(r.sale_id);
                  const span = isFirst
                    ? (pageSpanMap.get(r.sale_id)?.count ?? 1)
                    : 0;
                  return (
                    <tr
                      key={`${r.sale_id}-${r.product_code}-${Math.random()}`}
                      className="border-t"
                    >
                      {isFirst ? (
                        <>
                          <td
                            className="whitespace-nowrap px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.sale_date}
                          </td>
                          <td
                            className="whitespace-nowrap px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.client_code}
                          </td>
                          <td
                            className="truncate max-w-[100px] px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.client_name}
                          </td>
                          <td
                            className="whitespace-nowrap px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.client_phone}
                          </td>
                          <td
                            className="whitespace-nowrap px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.slip_number}
                          </td>
                        </>
                      ) : null}
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {r.product_code}
                      </td>
                      <td className="truncate max-w-[200px] px-2 py-1.5">
                        {r.product_name}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                        {r.amount}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                        {r.unit_price.toLocaleString("mn-MN")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums font-medium">
                        {r.sum_price.toLocaleString("mn-MN")}
                      </td>
                      {isFirst ? (
                        <>
                          <td
                            className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums"
                            rowSpan={span}
                          >
                            {r.cash_amount.toLocaleString("mn-MN")}
                          </td>
                          {bankAccounts.map((ba) => (
                            <td
                              key={ba.id}
                              className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums"
                              rowSpan={span}
                            >
                              {(
                                r.bankAllocs[String(ba.id)] || 0
                              ).toLocaleString("mn-MN")}
                            </td>
                          ))}
                          <td
                            className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums"
                            rowSpan={span}
                          >
                            {r.deferred_amount.toLocaleString("mn-MN")}
                          </td>
                          <td
                            className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-green-600"
                            rowSpan={span}
                          >
                            {r.discount_amount > 0
                              ? r.discount_amount.toLocaleString("mn-MN")
                              : "-"}
                          </td>
                          <td
                            className="truncate max-w-[100px] px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.user_name}
                          </td>
                          <td
                            className="whitespace-nowrap px-2 py-1.5"
                            rowSpan={span}
                          >
                            {r.created_at}
                          </td>
                          {isAdmin() && (
                            <td
                              className="whitespace-nowrap px-2 py-1.5"
                              rowSpan={span}
                            >
                              <Button
                                variant="outline"
                                size="xs"
                                className="text-destructive"
                                onClick={() =>
                                  setDeleteTarget({
                                    sale_id: r.sale_id,
                                    name: `${r.slip_number || `#${r.sale_id}`}`,
                                  })
                                }
                              >
                                Устгах
                              </Button>
                            </td>
                          )}
                        </>
                      ) : null}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Нийт мөр: {total}</span>
            <span>
              {(currentPage - 1) * perPage + 1}–
              {Math.min(currentPage * perPage, total)} / {total}
            </span>
          </div>

          {pageCount > 1 && (
            <Pagination className="mt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => goPage(currentPage - 1)}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {getPageNumbers(currentPage, pageCount).map((p, i) =>
                  p === "..." ? (
                    <PaginationItem key={`e${i}`}>
                      <span className="px-2 text-muted-foreground">...</span>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        onClick={() => goPage(p)}
                        isActive={currentPage === p}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => goPage(currentPage + 1)}
                    className={currentPage >= pageCount ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title="Тайлан устгах"
        message={`Борлуулалт (${deleteTarget?.name ?? ""})-ын тайланг устгах уу?`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default ReportsPage;
