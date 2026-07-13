import type { ParsedOcrData, Product, Shift } from "@/types/failure";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const valueAfterLabel = (text: string, labels: string[]) => {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s*[:#-]?\\s*([^\\n\\r]+)`, "i");
  return text.match(pattern)?.[1]?.trim();
};

export function parseOcrText(text: string, products: Product[]): ParsedOcrData {
  const normalizedText = normalize(text);
  const product = products.find(({ code }) => normalizedText.includes(normalize(code)));
  const operation = product?.operations.find(({ station }) => {
    const fullStation = normalize(station);
    const operationCode = normalize(station.split(" ")[0]);
    return normalizedText.includes(fullStation) || normalizedText.includes(operationCode);
  });

  const rawShift = valueAfterLabel(text, ["turno", "shift"]);
  const shiftMatch = rawShift?.match(/\b([abc])\b/i);
  const shift = shiftMatch?.[1]?.toUpperCase() as Shift | undefined;
  const operator = valueAfterLabel(text, ["operador(?:a)?", "operator", "legajo"]);
  const observations = valueAfterLabel(text, ["observaciones?", "observations?", "notas?"]);
  const quantities: Record<string, number> = {};

  operation?.failureModes.forEach((mode) => {
    const escaped = mode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*[:x-]?\\s*(\\d+)`, "i"));
    if (match) quantities[mode] = Number(match[1]);
  });

  return {
    productCode: product?.code,
    operationStation: operation?.station,
    shift,
    operator,
    observations,
    quantities,
  };
}
