import { createClient } from "@/lib/supabase/server";
import {
  assistantQuestions,
  type AssistantControl,
  type AssistantEvidence,
  type AssistantFilterOptions,
  type AssistantFilters,
  type AssistantMetrics,
  type AssistantQuestionId,
  type AssistantResponse,
} from "./types";

const emptyFilters: AssistantFilters = {
  plantId: "",
  customerId: "",
  productId: "",
  operationId: "",
  shift: "",
  dateFrom: "",
  dateTo: "",
};

type Bucket = {
  id: string;
  label: string;
  defects: number;
  inspectedQuantity: number;
  controls: number;
  context: Set<string>;
};

type GrowthBucket = {
  id: string;
  label: string;
  currentDefects: number;
  previousDefects: number;
};

export async function getAssistantInitialData() {
  const controls = await fetchAssistantControls();

  return {
    filterOptions: buildAssistantFilterOptions(controls),
  };
}

export async function runAssistantQuery(
  questionId: AssistantQuestionId,
  filters: AssistantFilters,
): Promise<AssistantResponse> {
  const controls = await fetchAssistantControls();
  const normalizedFilters = normalizeFilters(filters);

  switch (questionId) {
    case "operation-highest-dpu":
      return getOperationWithHighestDpu(controls, normalizedFilters);
    case "product-highest-dpu":
      return getProductWithHighestDpu(controls, normalizedFilters);
    case "failure-most-frequent":
      return getMostFrequentFailureMode(controls, normalizedFilters);
    case "shift-highest-dpu":
      return getShiftWithHighestDpu(controls, normalizedFilters);
    case "dpu-evolution":
      return getDpuEvolution(controls, normalizedFilters);
    case "failure-largest-growth":
      return getFailureModeWithLargestGrowth(controls, normalizedFilters);
    case "controls-highest-dpu":
      return getControlsWithHighestDpu(controls, normalizedFilters);
  }
}

export async function fetchAssistantControls() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("controls")
    .select(
      `
        id,
        operation_id,
        date,
        shift,
        operator,
        inspected_quantity,
        observations,
        created_at,
        updated_at,
        operations (
          id,
          code,
          name,
          products (
            id,
            code,
            name,
            customers (
              id,
              name,
              plants (
                id,
                name,
                companies (
                  id,
                  name
                )
              )
            )
          )
        ),
        control_failures (
          id,
          failure_mode_id,
          quantity,
          failure_modes (
            id,
            name
          )
        )
      `,
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AssistantControl[];
}

export function buildAssistantFilterOptions(controls: AssistantControl[]): AssistantFilterOptions {
  const plants = new Map<string, { id: string; name: string }>();
  const customers = new Map<string, { id: string; name: string; plantId: string }>();
  const products = new Map<
    string,
    { id: string; code: string; name: string; customerId: string; plantId: string }
  >();
  const operations = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      productId: string;
      customerId: string;
      plantId: string;
    }
  >();
  const shifts = new Set<string>();

  for (const control of controls) {
    const operation = control.operations;
    const product = operation?.products;
    const customer = product?.customers;
    const plant = customer?.plants;

    if (plant) {
      plants.set(plant.id, { id: plant.id, name: plant.name });
    }

    if (customer && plant) {
      customers.set(customer.id, { id: customer.id, name: customer.name, plantId: plant.id });
    }

    if (product && customer && plant) {
      products.set(product.id, {
        id: product.id,
        code: product.code,
        name: product.name,
        customerId: customer.id,
        plantId: plant.id,
      });
    }

    if (operation && product && customer && plant) {
      operations.set(operation.id, {
        id: operation.id,
        code: operation.code,
        name: operation.name,
        productId: product.id,
        customerId: customer.id,
        plantId: plant.id,
      });
    }

    if (control.shift) {
      shifts.add(control.shift);
    }
  }

  return {
    plants: Array.from(plants.values()).sort(sortByName),
    customers: Array.from(customers.values()).sort(sortByName),
    products: Array.from(products.values()).sort((left, right) =>
      left.code.localeCompare(right.code, "es"),
    ),
    operations: Array.from(operations.values()).sort((left, right) =>
      left.code.localeCompare(right.code, "es"),
    ),
    shifts: Array.from(shifts).sort((left, right) => left.localeCompare(right, "es")),
  };
}

export function getOperationWithHighestDpu(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const filteredControls = applyFilters(controls, filters);
  const buckets = new Map<string, Bucket>();

  for (const control of filteredControls) {
    const operation = control.operations;
    const id = operation?.id ?? control.operation_id;
    const label = operation ? `${operation.code} - ${operation.name}` : "Operacion sin datos";
    addControlToBucket(buckets, id, label, control, [
      `Pieza: ${formatProduct(control)}`,
      `Cliente: ${formatCustomer(control)}`,
    ]);
  }

  const top = getTopByDpu(buckets);
  if (!top) {
    return emptyResponse(questionsById["operation-highest-dpu"], filters);
  }

  return {
    question: questionsById["operation-highest-dpu"],
    result: top.label,
    explanation: `La operacion ${top.label} tiene el mayor DPU dentro de los filtros aplicados: ${formatDpu(
      calculateDpu(top),
    )}.`,
    metrics: toMetrics(top),
    filters,
    evidence: bucketEvidence(top, filteredControls, 5),
  };
}

export function getProductWithHighestDpu(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const filteredControls = applyFilters(controls, filters);
  const buckets = new Map<string, Bucket>();

  for (const control of filteredControls) {
    const product = control.operations?.products;
    const id = product?.id ?? "unknown-product";
    const label = product ? `${product.code} - ${product.name}` : "Pieza sin datos";
    addControlToBucket(buckets, id, label, control, [
      `Cliente: ${formatCustomer(control)}`,
      `Operacion: ${formatOperation(control)}`,
    ]);
  }

  const top = getTopByDpu(buckets);
  if (!top) {
    return emptyResponse(questionsById["product-highest-dpu"], filters);
  }

  return {
    question: questionsById["product-highest-dpu"],
    result: top.label,
    explanation: `La pieza ${top.label} tiene el mayor DPU dentro de los filtros aplicados: ${formatDpu(
      calculateDpu(top),
    )}.`,
    metrics: toMetrics(top),
    filters,
    evidence: bucketEvidence(top, filteredControls, 5),
  };
}

export function getMostFrequentFailureMode(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const filteredControls = applyFilters(controls, filters);
  const totals = calculateTotals(filteredControls);
  const buckets = new Map<string, { id: string; label: string; quantity: number; context: Set<string> }>();

  for (const control of filteredControls) {
    for (const failure of control.control_failures) {
      const label = failure.failure_modes?.name ?? "Modo de falla sin datos";
      const bucket = buckets.get(failure.failure_mode_id) ?? {
        id: failure.failure_mode_id,
        label,
        quantity: 0,
        context: new Set<string>(),
      };
      bucket.quantity += failure.quantity;
      bucket.context.add(`Control ${control.date} - ${formatOperation(control)}`);
      buckets.set(failure.failure_mode_id, bucket);
    }
  }

  const top = Array.from(buckets.values()).sort((left, right) => right.quantity - left.quantity)[0];
  if (!top) {
    return emptyResponse(questionsById["failure-most-frequent"], filters);
  }

  const metrics = {
    defects: top.quantity,
    inspectedQuantity: totals.inspectedQuantity,
    dpu: totals.inspectedQuantity > 0 ? top.quantity / totals.inspectedQuantity : 0,
  };

  return {
    question: questionsById["failure-most-frequent"],
    result: top.label,
    explanation: `El modo de falla ${top.label} es el mas frecuente, con ${formatInteger(
      top.quantity,
    )} defectos detectados.`,
    metrics,
    filters,
    evidence: Array.from(buckets.values())
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5)
      .map((bucket) => ({
        id: bucket.id,
        label: bucket.label,
        metrics: {
          defects: bucket.quantity,
          inspectedQuantity: totals.inspectedQuantity,
          dpu: totals.inspectedQuantity > 0 ? bucket.quantity / totals.inspectedQuantity : 0,
        },
        context: Array.from(bucket.context).slice(0, 3),
      })),
  };
}

export function getShiftWithHighestDpu(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const filteredControls = applyFilters(controls, filters);
  const buckets = new Map<string, Bucket>();

  for (const control of filteredControls) {
    addControlToBucket(buckets, control.shift, control.shift || "Turno sin datos", control, [
      `Operacion: ${formatOperation(control)}`,
      `Pieza: ${formatProduct(control)}`,
    ]);
  }

  const top = getTopByDpu(buckets);
  if (!top) {
    return emptyResponse(questionsById["shift-highest-dpu"], filters);
  }

  return {
    question: questionsById["shift-highest-dpu"],
    result: top.label,
    explanation: `El turno ${top.label} presenta el mayor DPU dentro de los filtros aplicados: ${formatDpu(
      calculateDpu(top),
    )}.`,
    metrics: toMetrics(top),
    filters,
    evidence: bucketEvidence(top, filteredControls, 5),
  };
}

export function getDpuEvolution(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const filteredControls = applyFilters(controls, filters);
  const buckets = new Map<string, Bucket>();

  for (const control of filteredControls) {
    addControlToBucket(buckets, control.date, control.date, control, [
      `Operacion: ${formatOperation(control)}`,
      `Turno: ${control.shift}`,
    ]);
  }

  const points = Array.from(buckets.values()).sort((left, right) => left.label.localeCompare(right.label));
  if (points.length === 0) {
    return emptyResponse(questionsById["dpu-evolution"], filters);
  }

  const first = points[0];
  const last = points[points.length - 1];
  const firstDpu = calculateDpu(first);
  const lastDpu = calculateDpu(last);
  const trend = lastDpu > firstDpu ? "aumento" : lastDpu < firstDpu ? "disminuyo" : "se mantuvo";
  const totals = calculateTotals(filteredControls);

  return {
    question: questionsById["dpu-evolution"],
    result: `${points.length} puntos de periodo`,
    explanation: `El DPU ${trend} desde ${formatDpu(firstDpu)} hasta ${formatDpu(
      lastDpu,
    )} en el periodo analizado.`,
    metrics: totals,
    filters,
    evidence: points.map((point) => ({
      id: point.id,
      label: point.label,
      metrics: toMetrics(point),
      context: [`Controles: ${formatInteger(point.controls)}`],
    })),
  };
}

export function getFailureModeWithLargestGrowth(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const controlsByNonDateFilters = applyFilters(controls, {
    ...filters,
    dateFrom: "",
    dateTo: "",
  });
  const periods = buildComparisonPeriods(controlsByNonDateFilters, filters);

  if (!periods) {
    return emptyResponse(questionsById["failure-largest-growth"], filters);
  }

  const currentControls = controlsByNonDateFilters.filter(
    (control) => control.date >= periods.currentStart && control.date <= periods.currentEnd,
  );
  const previousControls = controlsByNonDateFilters.filter(
    (control) => control.date >= periods.previousStart && control.date <= periods.previousEnd,
  );
  const buckets = new Map<string, GrowthBucket>();

  addFailuresToGrowthBuckets(buckets, currentControls, "currentDefects");
  addFailuresToGrowthBuckets(buckets, previousControls, "previousDefects");

  const ranked = Array.from(buckets.values()).sort(
    (left, right) =>
      right.currentDefects -
      right.previousDefects -
      (left.currentDefects - left.previousDefects),
  );
  const top = ranked[0];

  if (!top) {
    return emptyResponse(questionsById["failure-largest-growth"], filters);
  }

  const growth = top.currentDefects - top.previousDefects;
  const currentTotals = calculateTotals(currentControls);

  return {
    question: questionsById["failure-largest-growth"],
    result: growth > 0 ? top.label : "Sin crecimiento positivo",
    explanation:
      growth > 0
        ? `El modo de falla ${top.label} crecio ${formatInteger(
            growth,
          )} defectos respecto del periodo anterior.`
        : "Ningun modo de falla tuvo crecimiento positivo respecto del periodo anterior.",
    metrics: {
      defects: top.currentDefects,
      inspectedQuantity: currentTotals.inspectedQuantity,
      dpu:
        currentTotals.inspectedQuantity > 0
          ? top.currentDefects / currentTotals.inspectedQuantity
          : 0,
    },
    filters,
    evidence: ranked.slice(0, 5).map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      metrics: {
        defects: bucket.currentDefects - bucket.previousDefects,
        inspectedQuantity: currentTotals.inspectedQuantity,
        dpu:
          currentTotals.inspectedQuantity > 0
            ? (bucket.currentDefects - bucket.previousDefects) / currentTotals.inspectedQuantity
            : 0,
      },
      context: [
        `Periodo actual: ${periods.currentStart} a ${periods.currentEnd}`,
        `Periodo anterior: ${periods.previousStart} a ${periods.previousEnd}`,
        `Actual: ${formatInteger(bucket.currentDefects)} / Anterior: ${formatInteger(
          bucket.previousDefects,
        )}`,
      ],
    })),
  };
}

export function getControlsWithHighestDpu(
  controls: AssistantControl[],
  filters: AssistantFilters,
): AssistantResponse {
  const filteredControls = applyFilters(controls, filters);
  const ranked = filteredControls
    .map((control) => {
      const defects = getControlDefects(control);
      const inspectedQuantity = control.inspected_quantity;

      return {
        control,
        metrics: {
          defects,
          inspectedQuantity,
          dpu: inspectedQuantity > 0 ? defects / inspectedQuantity : 0,
        },
      };
    })
    .sort((left, right) => right.metrics.dpu - left.metrics.dpu || right.metrics.defects - left.metrics.defects);

  const top = ranked[0];
  if (!top) {
    return emptyResponse(questionsById["controls-highest-dpu"], filters);
  }

  return {
    question: questionsById["controls-highest-dpu"],
    result: `${top.control.date} - ${formatOperation(top.control)}`,
    explanation: `El control con mayor DPU tiene ${formatDpu(top.metrics.dpu)} y corresponde a ${
      top.control.date
    }, ${formatOperation(top.control)}.`,
    metrics: top.metrics,
    filters,
    evidence: ranked.slice(0, 7).map(({ control, metrics }) => ({
      id: control.id,
      label: `${control.date} - ${formatOperation(control)}`,
      metrics,
      context: [
        `Pieza: ${formatProduct(control)}`,
        `Turno: ${control.shift}`,
        `Operario: ${control.operator}`,
      ],
    })),
  };
}

function applyFilters(controls: AssistantControl[], filters: AssistantFilters) {
  return controls.filter((control) => {
    const product = control.operations?.products;
    const customer = product?.customers;
    const plant = customer?.plants;

    if (filters.plantId && plant?.id !== filters.plantId) {
      return false;
    }

    if (filters.customerId && customer?.id !== filters.customerId) {
      return false;
    }

    if (filters.productId && product?.id !== filters.productId) {
      return false;
    }

    if (filters.operationId && control.operation_id !== filters.operationId) {
      return false;
    }

    if (filters.shift && control.shift !== filters.shift) {
      return false;
    }

    if (filters.dateFrom && control.date < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && control.date > filters.dateTo) {
      return false;
    }

    return true;
  });
}

function normalizeFilters(filters: AssistantFilters): AssistantFilters {
  return {
    ...emptyFilters,
    ...filters,
  };
}

function addControlToBucket(
  buckets: Map<string, Bucket>,
  id: string,
  label: string,
  control: AssistantControl,
  context: string[],
) {
  const bucket = buckets.get(id) ?? {
    id,
    label,
    defects: 0,
    inspectedQuantity: 0,
    controls: 0,
    context: new Set<string>(),
  };
  bucket.defects += getControlDefects(control);
  bucket.inspectedQuantity += control.inspected_quantity;
  bucket.controls += 1;
  context.forEach((item) => bucket.context.add(item));
  buckets.set(id, bucket);
}

function getTopByDpu(buckets: Map<string, Bucket>) {
  return Array.from(buckets.values()).sort(
    (left, right) => calculateDpu(right) - calculateDpu(left) || right.defects - left.defects,
  )[0];
}

function bucketEvidence(top: Bucket, controls: AssistantControl[], limit: number): AssistantEvidence[] {
  const relatedControls = controls.filter((control) => {
    const operation = control.operations;
    const product = operation?.products;

    return (
      top.id === operation?.id ||
      top.id === product?.id ||
      top.id === control.shift ||
      top.id === control.date
    );
  });

  const rows = relatedControls.length > 0 ? relatedControls : controls;

  return rows
    .map((control) => {
      const defects = getControlDefects(control);
      const inspectedQuantity = control.inspected_quantity;

      return {
        id: control.id,
        label: `${control.date} - ${formatOperation(control)}`,
        metrics: {
          defects,
          inspectedQuantity,
          dpu: inspectedQuantity > 0 ? defects / inspectedQuantity : 0,
        },
        context: [
          `Pieza: ${formatProduct(control)}`,
          `Turno: ${control.shift}`,
          `Operario: ${control.operator}`,
        ],
      };
    })
    .sort((left, right) => right.metrics.dpu - left.metrics.dpu)
    .slice(0, limit);
}

function calculateTotals(controls: AssistantControl[]): AssistantMetrics {
  const inspectedQuantity = controls.reduce(
    (sum, control) => sum + control.inspected_quantity,
    0,
  );
  const defects = controls.reduce((sum, control) => sum + getControlDefects(control), 0);

  return {
    defects,
    inspectedQuantity,
    dpu: inspectedQuantity > 0 ? defects / inspectedQuantity : 0,
  };
}

function calculateDpu(bucket: Bucket) {
  return bucket.inspectedQuantity > 0 ? bucket.defects / bucket.inspectedQuantity : 0;
}

function toMetrics(bucket: Bucket): AssistantMetrics {
  return {
    defects: bucket.defects,
    inspectedQuantity: bucket.inspectedQuantity,
    dpu: calculateDpu(bucket),
  };
}

function getControlDefects(control: AssistantControl) {
  return control.control_failures.reduce((sum, failure) => sum + failure.quantity, 0);
}

function emptyResponse(question: string, filters: AssistantFilters): AssistantResponse {
  return {
    question,
    result: "Sin datos",
    explanation: "No hay controles que cumplan los filtros seleccionados.",
    metrics: {
      defects: 0,
      inspectedQuantity: 0,
      dpu: 0,
    },
    filters,
    evidence: [],
  };
}

function buildComparisonPeriods(controls: AssistantControl[], filters: AssistantFilters) {
  const dates = controls.map((control) => control.date).sort();
  const minDate = dates[0];
  const maxDate = dates.at(-1);

  if (!minDate || !maxDate) {
    return null;
  }

  if (filters.dateFrom || filters.dateTo) {
    const currentStart = filters.dateFrom || minDate;
    const currentEnd = filters.dateTo || maxDate;
    const days = Math.max(1, diffDays(currentStart, currentEnd) + 1);
    const previousEnd = addDays(currentStart, -1);

    return {
      currentStart,
      currentEnd,
      previousStart: addDays(previousEnd, -(days - 1)),
      previousEnd,
    };
  }

  const totalDays = Math.max(1, diffDays(minDate, maxDate) + 1);
  const currentDays = Math.max(1, Math.ceil(totalDays / 2));
  const currentStart = addDays(maxDate, -(currentDays - 1));
  const previousEnd = addDays(currentStart, -1);

  return {
    currentStart,
    currentEnd: maxDate,
    previousStart: addDays(previousEnd, -(currentDays - 1)),
    previousEnd,
  };
}

function addFailuresToGrowthBuckets(
  buckets: Map<string, GrowthBucket>,
  controls: AssistantControl[],
  field: "currentDefects" | "previousDefects",
) {
  for (const control of controls) {
    for (const failure of control.control_failures) {
      const bucket = buckets.get(failure.failure_mode_id) ?? {
        id: failure.failure_mode_id,
        label: failure.failure_modes?.name ?? "Modo de falla sin datos",
        currentDefects: 0,
        previousDefects: 0,
      };
      bucket[field] += failure.quantity;
      buckets.set(failure.failure_mode_id, bucket);
    }
  }
}

function diffDays(start: string, end: string) {
  return Math.floor((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOperation(control: AssistantControl) {
  const operation = control.operations;
  return operation ? `${operation.code} - ${operation.name}` : "Operacion sin datos";
}

function formatProduct(control: AssistantControl) {
  const product = control.operations?.products;
  return product ? `${product.code} - ${product.name}` : "Pieza sin datos";
}

function formatCustomer(control: AssistantControl) {
  return control.operations?.products?.customers?.name ?? "Cliente sin datos";
}

function formatDpu(value: number) {
  return value.toFixed(3);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es").format(value);
}

function sortByName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name, "es");
}

const questionsById = assistantQuestions.reduce<Record<AssistantQuestionId, string>>(
  (questions, question) => ({
    ...questions,
    [question.id]: question.label,
  }),
  {} as Record<AssistantQuestionId, string>,
);
