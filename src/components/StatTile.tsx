import { Card } from "@/components/Card";

export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className={`p-3 ${tone === "warning" ? "border-amber-200/70" : ""}`}>
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p
        className={`text-xl font-semibold mt-0.5 ${
          tone === "warning" ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
