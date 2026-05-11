"use client";

import { CalculatorIcon, CheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CALC_BUTTONS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "-"],
  [".", "0", "⌫", "+"],
];

export function AmountInput({ value, onChange, currency, placeholder = "0.00", className = "", disabled }: AmountInputProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [expr, setExpr] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalc) return;
    setExpr(value || "");
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setShowCalc(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCalc, value]);

  function handleCalcInput(btn: string) {
    if (btn === "⌫") {
      setExpr((e) => e.slice(0, -1));
    } else if (btn === "÷") {
      setExpr((e) => e + "/");
    } else if (btn === "×") {
      setExpr((e) => e + "*");
    } else {
      setExpr((e) => e + btn);
    }
  }

  function evalExpr() {
    try {
      // Safe eval: only allow digits, operators, dots, spaces
      const safe = expr.replace(/[^0-9+\-*/().]/g, "");
      if (!safe) return;
      // eslint-disable-next-line no-eval
      const result = eval(safe);
      if (typeof result === "number" && isFinite(result)) {
        const rounded = Math.round(result * 100) / 100;
        onChange(String(rounded));
        setShowCalc(false);
      }
    } catch {
      // invalid expression — ignore
    }
  }

  function displayExpr() {
    return expr.replace(/\*/g, "×").replace(/\//g, "÷");
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex">
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            "h-10 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] pl-3 pr-16 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]",
            disabled ? "cursor-not-allowed opacity-50" : "",
            className,
          ].join(" ")}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {currency && (
            <span className="text-[11px] font-medium text-[rgb(var(--muted))] px-1">{currency}</span>
          )}
          <button
            type="button"
            onClick={() => setShowCalc((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--foreground))]"
            title="Calculator"
          >
            <CalculatorIcon size={14} />
          </button>
        </div>
      </div>

      {showCalc && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] shadow-2xl">
          {/* Expression display */}
          <div className="flex items-center justify-between border-b border-[rgb(var(--border-soft))] bg-[rgb(var(--surface-soft))] px-3 py-2">
            <span className="min-h-[1.5rem] font-mono text-sm text-[rgb(var(--foreground))]">
              {displayExpr() || <span className="text-[rgb(var(--muted))]">0</span>}
            </span>
            <button
              type="button"
              onClick={() => setShowCalc(false)}
              className="ml-2 flex h-5 w-5 items-center justify-center rounded-md text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
            >
              <XIcon size={11} />
            </button>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-4 gap-px bg-[rgb(var(--border-soft))] p-px">
            {CALC_BUTTONS.map((row) =>
              row.map((btn) => {
                const isOp = ["÷", "×", "-", "+"].includes(btn);
                const isBack = btn === "⌫";
                return (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleCalcInput(btn)}
                    className={[
                      "flex h-10 items-center justify-center text-sm font-medium transition active:scale-95",
                      isOp
                        ? "bg-[rgb(var(--surface))] text-[rgb(var(--accent))] hover:bg-[rgb(var(--surface-soft))]"
                        : isBack
                        ? "bg-[rgb(var(--surface))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-soft))]"
                        : "bg-[rgb(var(--background))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--surface-soft))]",
                    ].join(" ")}
                  >
                    {btn}
                  </button>
                );
              })
            )}
          </div>

          {/* OK button */}
          <div className="bg-[rgb(var(--border-soft))] p-px pt-0">
            <button
              type="button"
              onClick={evalExpr}
              className="flex h-11 w-full items-center justify-center gap-1.5 bg-[rgb(var(--accent))] text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
            >
              <CheckIcon size={14} weight="bold" />
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
