import { useEffect, useState, useMemo } from "react";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import { getLogs, type LogEntry } from "@/lib/api";
import { getPageNumbers } from "@/lib/utils";

const PER_PAGE = 100;

function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hideLogsRoute, setHideLogsRoute] = useState(true);

  useEffect(() => {
    getLogs().then((res) => setLogs(res.data));
  }, []);

  const filtered = useMemo(
    () => (hideLogsRoute ? logs.filter((e) => e.path !== "/logs") : logs),
    [logs, hideLogsRoute],
  );

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page],
  );

  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages));
  }, [page, totalPages]);

  const statusColor = (s: number) => {
    if (s < 300) return "text-green-600";
    if (s < 400) return "text-blue-600";
    if (s < 500) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Системийн лог</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Сүүлийн 7 хоногийн хүсэлтүүд (нийт: {filtered.length})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => getLogs().then((res) => setLogs(res.data))} className="text-sm text-muted-foreground hover:text-foreground transition-colors" title="Сэргээх">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <Switch
              checked={hideLogsRoute}
              onCheckedChange={(checked) => { setHideLogsRoute(checked); setPage(1); }}
            />
            Логын хүсэлтийг нуух
          </label>
        </div>
      </div>
      <Separator className="my-4" />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Огноо</TableHead>
              <TableHead>Хэрэглэгч</TableHead>
              <TableHead>Хүсэлт</TableHead>
              <TableHead>Зам</TableHead>
              <TableHead>Параметр</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Хугацаа</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Лог олдсонгүй
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs whitespace-nowrap py-1">{e.timestamp}</TableCell>
                  <TableCell className="py-1">
                    <span className="font-mono text-xs">{e.username}</span>
                  </TableCell>
                  <TableCell className="py-1">
                    <span className="font-mono text-xs font-medium">{e.method}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[250px] truncate py-1">{e.path}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[150px] truncate text-muted-foreground py-1">
                    {e.query || "—"}
                  </TableCell>
                  <TableCell className="py-1">
                    <span className={`font-mono text-xs font-bold ${statusColor(e.status)}`}>
                      {e.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums py-1">
                    {e.duration_ms}ms
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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

export default LogsPage;
