"use client"

import { Check, AlertTriangle, AlertCircle } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"

interface Warning {
  tipo: string
  mensaje: string
}

interface Props {
  filaExcel: number
  estado: "ok" | "warning" | "error"
  warnings?: Warning[]
}

const rowStyles = {
  ok: {
    Icon: Check,
    label: "OK",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    Icon: AlertTriangle,
    label: "Warning",
    tone: "text-amber-600 dark:text-amber-400",
  },
  error: {
    Icon: AlertCircle,
    label: "Error",
    tone: "text-destructive",
  },
} as const

export function ImportRowStatus({
  filaExcel,
  estado,
  warnings = [],
}: Props) {
  const { Icon, label, tone } = rowStyles[estado]

  const tooltipContent =
    warnings.length > 0
      ? warnings.map((w) => `• ${w.mensaje}`).join("\n")
      : `Fila Excel r${filaExcel} — ${label}`

  return (
    <Tooltip>
      <TooltipTrigger
        className={`inline-flex items-center gap-1 font-mono text-sm ${tone}`}
        aria-label={`Row ${filaExcel} status: ${label}${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ""}`}
      >
        <Icon className="h-4 w-4" />
        r{filaExcel}
      </TooltipTrigger>
      <TooltipContent>
        <div className="whitespace-pre-line text-xs">
          {tooltipContent}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
