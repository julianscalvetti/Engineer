"use server";

import { runAssistantQuery } from "@/lib/assistant/quality-assistant";
import { getCurrentProfile } from "@/lib/auth/server";
import {
  assistantQuestions,
  type AssistantFilters,
  type AssistantQuestionId,
} from "@/lib/assistant/types";

export async function analyzeQualityQuestion(
  questionId: AssistantQuestionId,
  filters: AssistantFilters,
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("Sesion requerida.");
  }

  if (!assistantQuestions.some((question) => question.id === questionId)) {
    throw new Error("Pregunta no soportada.");
  }

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new Error("El periodo seleccionado no es valido.");
  }

  return runAssistantQuery(questionId, filters);
}
