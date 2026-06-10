import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPageNumbers(current: number, total: number, maxVisible: number = 7): (number | "...")[] {
  if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1)

  const half = Math.floor(maxVisible / 2)
  const pages: (number | "...")[] = []

  if (current <= half + 2) {
    for (let i = 1; i <= Math.min(maxVisible - 1, total); i++) pages.push(i)
    if (total > maxVisible - 1) pages.push("...", total)
  } else if (current >= total - half - 1) {
    pages.push(1, "...")
    for (let i = Math.max(total - maxVisible + 2, 1); i <= total; i++) pages.push(i)
  } else {
    pages.push(1, "...")
    for (let i = current - half + 1; i <= current + half - 1; i++) pages.push(i)
    pages.push("...", total)
  }

  return pages
}
