import type { QuestionnaireConfig } from '../types/config';

/**
 * Whether the extra-info questionnaire step should appear in the flow. It's
 * active only when it has at least one configured question AND hasn't been
 * turned off (`enabled: false`) — the builder's Questionnaire toggle disables
 * the step while keeping the question definitions intact.
 *
 * Single source of truth for the gate: the step order, the skip logic in
 * id-input / document-capture / liveness, and the preview placeholder all read
 * this so they can never disagree.
 */
export function hasActiveQuestionnaire(
  questionnaire: QuestionnaireConfig | undefined | null,
): boolean {
  return questionnaire?.enabled !== false && (questionnaire?.fields?.length ?? 0) > 0;
}
