"use client";

import { useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { getStockStatus, type Product, type StockTransaction } from "@/lib/types";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const MANILA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY_LABEL = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "short",
  day: "numeric",
});

const textColor = "#5b6a5e";
const gridColor = "#e7eee3";

type DashboardChartsProps = {
  products: Product[];
  transactions: StockTransaction[];
  variant: "movement" | "health";
};

export function DashboardCharts({ products, transactions, variant }: DashboardChartsProps) {
  const [referenceTime] = useState(() => Date.now());
  const movement = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(referenceTime - (6 - index) * 86_400_000);
      return { key: MANILA_DAY.format(date), label: DAY_LABEL.format(date) };
    });

    const received = new Map(days.map((day) => [day.key, 0]));
    const released = new Map(days.map((day) => [day.key, 0]));

    for (const transaction of transactions) {
      const key = MANILA_DAY.format(new Date(transaction.createdAt));
      const target = transaction.type === "Stock In" ? received : released;
      if (target.has(key)) target.set(key, (target.get(key) ?? 0) + transaction.quantity);
    }

    return {
      labels: days.map((day) => day.label),
      received: days.map((day) => received.get(day.key) ?? 0),
      released: days.map((day) => released.get(day.key) ?? 0),
    };
  }, [referenceTime, transactions]);

  const health = useMemo(() => {
    const counts = { inStock: 0, lowStock: 0, outOfStock: 0 };
    for (const product of products) {
      const status = getStockStatus(product);
      if (status === "In Stock") counts.inStock += 1;
      if (status === "Low Stock") counts.lowStock += 1;
      if (status === "Out of Stock") counts.outOfStock += 1;
    }
    return counts;
  }, [products]);

  const movementData: ChartData<"bar"> = {
    labels: movement.labels,
    datasets: [
      {
        label: "Received",
        data: movement.received,
        backgroundColor: "#167a43",
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 24,
      },
      {
        label: "Released",
        data: movement.released,
        backgroundColor: "#f0b429",
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 24,
      },
    ],
  };

  const movementOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: {
        align: "start",
        labels: { color: textColor, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded" },
      },
      tooltip: {
        callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y} units` },
      },
    },
    scales: {
      x: { stacked: false, border: { display: false }, grid: { display: false }, ticks: { color: textColor } },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: gridColor },
        ticks: { color: textColor, precision: 0 },
      },
    },
  };

  const healthData: ChartData<"doughnut"> = {
    labels: ["Healthy", "Low stock", "Out of stock"],
    datasets: [{
      data: [health.inStock, health.lowStock, health.outOfStock],
      backgroundColor: ["#167a43", "#f0b429", "#cf1f27"],
      borderColor: "#ffffff",
      borderWidth: 3,
      hoverOffset: 4,
    }],
  };

  const healthOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.parsed} products` } },
    },
  };

  const totalMovement = movement.received.reduce((sum, value) => sum + value, 0)
    + movement.released.reduce((sum, value) => sum + value, 0);

  if (variant === "movement") {
    return (
      <>
        <div className="h-[260px] sm:h-[300px]">
          {totalMovement > 0 ? (
            <Bar
              data={movementData}
              options={movementOptions}
              role="img"
              aria-label="Bar chart of units received and released for each of the last seven days"
            />
          ) : (
            <div className="grid h-full place-items-center rounded-xl bg-[var(--muted)] px-6 text-center">
              <div>
                <p className="text-sm font-semibold">No movement in the last 7 days</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Received stock and completed sales will appear here.</p>
              </div>
            </div>
          )}
        </div>
        <span className="sr-only">
          Seven-day totals: {movement.received.reduce((sum, value) => sum + value, 0)} units received and {movement.released.reduce((sum, value) => sum + value, 0)} units released.
        </span>
      </>
    );
  }

  return (
    <>
      <div className="relative mx-auto h-[190px] w-full max-w-[240px]">
        {products.length > 0 ? (
          <Doughnut
            data={healthData}
            options={healthOptions}
            role="img"
            aria-label={`Inventory health chart: ${health.inStock} healthy, ${health.lowStock} low-stock, and ${health.outOfStock} out-of-stock products`}
          />
        ) : (
          <div className="grid h-full place-items-center rounded-full border border-dashed border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">No products yet</div>
        )}
        {products.length > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-hidden="true">
            <div><strong className="block text-2xl tracking-[-0.03em]">{products.length}</strong><span className="text-[11px] text-[var(--muted-foreground)]">products</span></div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <ChartKey color="bg-[var(--accent)]" label="Healthy" value={health.inStock} />
        <ChartKey color="bg-amber-400" label="Low" value={health.lowStock} />
        <ChartKey color="bg-[var(--destructive)]" label="Out" value={health.outOfStock} />
      </div>
    </>
  );
}

function ChartKey({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="min-w-0">
      <span className={`mx-auto mb-1.5 block size-2 rounded-sm ${color}`} aria-hidden="true" />
      <strong className="block text-sm">{value}</strong>
      <span className="block truncate text-[11px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}
