import { Lock, LockOpen, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
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
import { getSalesSummary, getBankAccounts, getClientsAll, toggleSaleLock, type SaleSummary, type BankAccount, type Client } from "@/lib/api";
import { getPageNumbers, formatDateLocal } from "@/lib/utils";

const PER_PAGE = 100;

function formatNum(n: number) {
  return n.toLocaleString("mn-MN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SalesSummaryPage() {
  const [data, setData] = useState<SaleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    getBankAccounts().then(setBankAccounts);
    getClientsAll().then(setClients);
  }, []);

  const [loadingId, setLoadingId] = useState<number | null>(null);

  const fetchData = useCallback((p: number) => {
    const filters: Record<string, string> = {};
    if (clientCode || clientName) filters.client_name = clientName || clientCode;
    if (fromDate) filters.from = formatDateLocal(fromDate);
    if (toDate) filters.to = formatDateLocal(toDate);
    getSalesSummary({ ...filters, page: p, per_page: PER_PAGE }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      setTotalPages(Math.ceil(res.total / PER_PAGE));
    });
  }, [clientCode, clientName, fromDate, toDate]);

  const toggleLock = useCallback(async (id: number) => {
    setLoadingId(id);
    try {
      await toggleSaleLock(id);
      fetchData(page);
    } catch (e) {
      fetchData(page);
      alert(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setLoadingId(null);
    }
  }, [fetchData, page]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  useEffect(() => { setPage(1); }, [clientCode, clientName, fromDate, toDate]);

  const statusEl = (s: string) => {
    if (s === "draft")
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
  };

  return (
    <div>
      <h1 className="text-lg font-medium">Нэгтгэл</h1>
      <p className="text-sm text-muted-foreground mt-1">Нийт: {total} борлуулалт</p>
      <Separator className="my-4" />

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Эхлэх огноо</label>
          <DatePicker value={fromDate} onChange={setFromDate} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Дуусах огноо</label>
          <DatePicker value={toDate} onChange={setToDate} />
        </div>
        <div className="flex flex-col gap-1 min-w-56">
          <label className="text-xs text-muted-foreground">Харилцагч</label>
          <ClientSelect
            clients={clients}
            selectedCode={clientCode}
            selectedName={clientName}
            selectedPhone={clientPhone}
            onSelect={({ client_code, client_name, client_phone }) => {
              setClientCode(client_code);
              setClientName(client_name);
              setClientPhone(client_phone);
            }}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b">
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Огноо</th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Төлөв</th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Харилцагч</th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Падаан №</th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Борлуулалтын төлөв</th>
              <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Дүн</th>
              <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Бэлэн</th>
              {bankAccounts.map((ba) => (
                  <th
                    key={ba.id}
                    className="h-10 px-2 text-center align-middle font-medium whitespace-nowrap"
                    title={`${ba.bank_name} - ${ba.account_number}`}
                  >
                  <div className="flex flex-col items-center">
                    <span>{ba.bank_name}</span>
                    {ba.account_name && <span className="text-muted-foreground">({ba.account_name})</span>}
                  </div>
                </th>
              ))}
              <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Дараа төлбөр</th>
              <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Хөнгөлөлт</th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Бүртгэсэн</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10 + bankAccounts.length} className="h-24 text-center text-muted-foreground">
                  Борлуулалт олдсонгүй
                </td>
              </tr>
            ) : (
              data.map((s) => (
                <tr key={s.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="px-2 py-1.5 align-middle text-xs whitespace-nowrap">{s.sale_date}</td>
                  <td className="px-2 py-1.5 align-middle text-xs">
                    <button
                      onClick={() => toggleLock(s.id)}
                      disabled={loadingId !== null}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                        s.is_locked
                          ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}
                    >
                      {loadingId === s.id ? <Loader2 className="size-3 animate-spin" /> : s.is_locked ? <><Lock className="size-3" /><span>Түгжээтэй</span></> : <><LockOpen className="size-3" /><span>Нээлттэй</span></>}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 align-middle text-xs truncate max-w-[150px]">{s.client_name || s.client_code || "—"}</td>
                  <td className="px-2 py-1.5 align-middle text-xs">{s.slip_number || "—"}</td>
                  <td className="px-2 py-1.5 align-middle text-xs whitespace-nowrap">{statusEl(s.status)}</td>
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">{formatNum(s.total_amount)}</td>
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">{formatNum(s.cash_amount)}</td>
                  {bankAccounts.map((ba) => {
                    const alloc = s.bank_allocations[String(ba.id)];
                    return (
                      <td key={ba.id} className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">
                        {alloc ? formatNum(alloc) : "-"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">{formatNum(s.deferred_amount)}</td>
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums text-green-600">
                    {s.discount_amount > 0 ? formatNum(s.discount_amount) : "-"}
                  </td>
                  <td className="px-2 py-1.5 align-middle text-xs truncate max-w-[100px]">{s.user_name || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
              />
            </PaginationItem>
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <span className="px-2 text-muted-foreground">...</span>
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => { e.preventDefault(); setPage(p as number); }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export default SalesSummaryPage;
