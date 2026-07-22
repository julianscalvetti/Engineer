export const assistantQuestions = [
  {
    id: "operation-highest-dpu",
    label: "Cual es la operacion con mayor DPU?",
  },
  {
    id: "product-highest-dpu",
    label: "Cual es la pieza con mayor DPU?",
  },
  {
    id: "failure-most-frequent",
    label: "Cual es el modo de falla mas frecuente?",
  },
  {
    id: "shift-highest-dpu",
    label: "Que turno presenta mayor DPU?",
  },
  {
    id: "dpu-evolution",
    label: "Como evoluciono el DPU?",
  },
  {
    id: "failure-largest-growth",
    label: "Que modo de falla crecio mas respecto del periodo anterior?",
  },
  {
    id: "controls-highest-dpu",
    label: "Que controles explican el mayor DPU?",
  },
] as const;

export type AssistantQuestionId = (typeof assistantQuestions)[number]["id"];

export type AssistantFilters = {
  plantId: string;
  customerId: string;
  productId: string;
  operationId: string;
  shift: string;
  dateFrom: string;
  dateTo: string;
};

export type AssistantMetrics = {
  defects: number;
  inspectedQuantity: number;
  dpu: number;
};

export type AssistantEvidence = {
  id: string;
  label: string;
  metrics: AssistantMetrics;
  context: string[];
};

export type AssistantResponse = {
  question: string;
  result: string;
  explanation: string;
  metrics: AssistantMetrics;
  filters: AssistantFilters;
  evidence: AssistantEvidence[];
};

export type AssistantFilterOptions = {
  plants: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string; plantId: string }>;
  products: Array<{ id: string; code: string; name: string; customerId: string; plantId: string }>;
  operations: Array<{
    id: string;
    code: string;
    name: string;
    productId: string;
    customerId: string;
    plantId: string;
  }>;
  shifts: string[];
};

export type AssistantControlFailure = {
  id: string;
  failure_mode_id: string;
  quantity: number;
  failure_modes: {
    id: string;
    name: string;
  } | null;
};

export type AssistantControl = {
  id: string;
  operation_id: string;
  date: string;
  shift: string;
  operator: string;
  inspected_quantity: number;
  observations: string | null;
  created_at: string;
  updated_at: string;
  operations: {
    id: string;
    code: string;
    name: string;
    products: {
      id: string;
      code: string;
      name: string;
      customers: {
        id: string;
        name: string;
        plants: {
          id: string;
          name: string;
          companies: {
            id: string;
            name: string;
          } | null;
        } | null;
      } | null;
    } | null;
  } | null;
  control_failures: AssistantControlFailure[];
};
