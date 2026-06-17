import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
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
import { getSalesSummary, getSalesSummaryAll, getBankAccounts, getClientsAll, type SaleSummary, type BankAccount, type Client } from "@/lib/api";
import * as XLSX from "xlsx";
import { getPageNumbers, formatDateLocal } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const PER_PAGE = 100;

function formatNum(n: number) {
  return n.toLocaleString("mn-MN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SalesSummaryPage() {
  const [data, setData] = useState<SaleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const headerSentinelRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [headerPos, setHeaderPos] = useState({ left: 0, width: 0 });
  const [scrollLeft, setScrollLeft] = useState(0);
  const [colWidths, setColWidths] = useState<number[]>([]);

  const measureColWidths = useCallback(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const ths = wrapper.querySelectorAll<HTMLElement>("thead th");
    setColWidths(Array.from(ths).map((th) => th.getBoundingClientRect().width));
  }, []);

  const updateHeaderPos = useCallback(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const r = wrapper.getBoundingClientRect();
    setHeaderPos({ left: r.left, width: r.width });
  }, []);

  const onScroll = useCallback(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    setScrollLeft(wrapper.scrollLeft);
  }, []);

  const onDataReady = useCallback(() => {
    measureColWidths();
    updateHeaderPos();
  }, [measureColWidths, updateHeaderPos]);

  useEffect(() => {
    const el = headerSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyHeader(!entry.isIntersecting);
        updateHeaderPos();
      },
      { threshold: 0 },
    );
    observer.observe(el);
    window.addEventListener("resize", onDataReady);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onDataReady);
    };
  }, [updateHeaderPos, onDataReady]);

  useEffect(() => {
    if (!loading && data.length > 0) {
      onDataReady();
      const wrapper = tableWrapperRef.current;
      if (wrapper) {
        wrapper.addEventListener("scroll", onScroll);
        return () => wrapper.removeEventListener("scroll", onScroll);
      }
    }
  }, [loading, data, onDataReady, onScroll]);

  useEffect(() => {
    getBankAccounts().then(setBankAccounts);
    getClientsAll().then(setClients);
  }, []);

  const fetchData = useCallback((p: number) => {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (clientCode || clientName) filters.client_name = clientName || clientCode;
    if (fromDate) filters.from = formatDateLocal(fromDate);
    if (toDate) filters.to = formatDateLocal(toDate);
    getSalesSummary({ ...filters, page: p, per_page: PER_PAGE }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      setTotalPages(Math.ceil(res.total / PER_PAGE));
    }).finally(() => setLoading(false));
  }, [clientCode, clientName, fromDate, toDate]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  useEffect(() => { setPage(1); }, [clientCode, clientName, fromDate, toDate]);

  const totals = useMemo(() => {
    const t = { total_amount: 0, cash_amount: 0, deferred_amount: 0, discount_amount: 0, bank: {} as Record<string, number> };
    for (const s of data) {
      t.total_amount += s.total_amount;
      t.cash_amount += s.cash_amount;
      t.deferred_amount += s.deferred_amount;
      t.discount_amount += s.discount_amount;
      for (const [baId, amount] of Object.entries(s.bank_allocations)) {
        t.bank[baId] = (t.bank[baId] || 0) + amount;
      }
    }
    return t;
  }, [data]);

  const exportPdf = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", formatDateLocal(fromDate));
    if (toDate) params.set("to", formatDateLocal(toDate));
    if (clientName || clientCode) params.set("client_name", clientName || clientCode);
    const token = localStorage.getItem("token");
    const url = `${API_BASE}/sales/admin-summary/pdf?${params}&token=${encodeURIComponent(token || "")}`;
    window.open(url, "_blank");
  };

  const exportExcel = async () => {
    const filters: Record<string, string> = {};
    if (fromDate) filters.from = formatDateLocal(fromDate);
    if (toDate) filters.to = formatDateLocal(toDate);
    if (clientName || clientCode) filters.client_name = clientName || clientCode;
    const allData = await getSalesSummaryAll(filters);

    const headers = [
      "Огноо",
      "Дүн",
      "Бэлэн",
      ...bankAccounts.map(
        (ba) => ba.account_name ? `${ba.bank_name} (${ba.account_name})` : ba.bank_name,
      ),
      "Дараа төлбөр",
      "Хөнгөлөлт",
    ];

    const sorted = allData.sort((a, b) => b.sale_date.localeCompare(a.sale_date));

    const ttl = { total_amount: 0, cash_amount: 0, deferred_amount: 0, discount_amount: 0, bank: {} as Record<string, number> };
    const body: any[][] = sorted.map((s) => {
      ttl.total_amount += s.total_amount;
      ttl.cash_amount += s.cash_amount;
      ttl.deferred_amount += s.deferred_amount;
      ttl.discount_amount += s.discount_amount;
      for (const [baId, amount] of Object.entries(s.bank_allocations)) {
        ttl.bank[baId] = (ttl.bank[baId] || 0) + amount;
      }
      return [
        s.sale_date,
        s.total_amount,
        s.cash_amount,
        ...bankAccounts.map((ba) => s.bank_allocations[String(ba.id)] || 0),
        s.deferred_amount,
        s.discount_amount,
      ];
    });

    body.push([
      "Нийт",
      ttl.total_amount,
      ttl.cash_amount,
      ...bankAccounts.map((ba) => ttl.bank[String(ba.id)] || 0),
      ttl.deferred_amount,
      ttl.discount_amount,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Нэгтгэл");

    const parts: string[] = ["neltgel_export"];
    if (fromDate) parts.push("from_" + fromDate.toISOString().slice(0, 10));
    if (toDate) parts.push("to_" + toDate.toISOString().slice(0, 10));
    XLSX.writeFile(wb, parts.join("_") + ".xlsx");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Нэгтгэл</h1>
          <p className="text-sm text-muted-foreground mt-1">Нийт: {total} өдөр</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={data.length === 0}>
            PDF экспорт
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={data.length === 0}>
            Excel экспорт
          </Button>
        </div>
      </div>
      <Separator className="my-4" />
      <div ref={headerSentinelRef} className="h-px" />

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

      {showStickyHeader && (
        <div
          className="fixed top-0 z-40 overflow-hidden bg-background shadow-md"
          style={{ left: headerPos.left, width: headerPos.width }}
        >
          <table className="w-full text-xs" style={{ tableLayout: "fixed", marginLeft: -scrollLeft }}>
            {colWidths.length > 0 && (
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={i} style={{ width: w, minWidth: w }} />
                ))}
              </colgroup>
            )}
            <thead>
              <tr className="border-b">
                <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Огноо</th>
                <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Дүн</th>
                <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Бэлэн</th>
                {bankAccounts.map((ba) => (
                  <th key={ba.id} className="h-10 px-2 text-center align-middle font-medium whitespace-nowrap">
                    <div className="flex flex-col items-center">
                      <span>{ba.bank_name}</span>
                      {ba.account_name && <span className="text-muted-foreground">({ba.account_name})</span>}
                    </div>
                  </th>
                ))}
                <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Дараа төлбөр</th>
                <th className="h-10 px-2 text-right align-middle font-medium whitespace-nowrap">Хөнгөлөлт</th>
              </tr>
            </thead>
          </table>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto" ref={tableWrapperRef}>
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b">
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">Огноо</th>
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3 + bankAccounts.length} className="text-center">
                  <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-sm">Уншиж байна...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={3 + bankAccounts.length} className="h-24 text-center text-muted-foreground">
                  Борлуулалт олдсонгүй
                </td>
              </tr>
            ) : (
              <>
                <tr className="border-b bg-muted/30 font-semibold">
                  <td className="px-2 py-1.5 align-middle text-xs whitespace-nowrap">Нийт</td>
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">{formatNum(totals.total_amount)}</td>
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">{formatNum(totals.cash_amount)}</td>
                  {bankAccounts.map((ba) => {
                    const amount = totals.bank[String(ba.id)];
                    return (
                      <td key={ba.id} className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">
                        {amount ? formatNum(amount) : "-"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">{formatNum(totals.deferred_amount)}</td>
                  <td className="px-2 py-1.5 align-middle text-xs text-right tabular-nums">
                    {totals.discount_amount > 0 ? formatNum(totals.discount_amount) : "-"}
                  </td>
                </tr>
                {data.map((s) => (
                  <tr key={s.sale_date} className="border-b transition-colors hover:bg-muted/50">
                    <td className="px-2 py-1.5 align-middle text-xs whitespace-nowrap">{s.sale_date}</td>
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
                  </tr>
                ))}
              </>
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
