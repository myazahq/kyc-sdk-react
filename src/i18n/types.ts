/**
 * The SDK's text catalogue: every piece of copy an applicant reads, keyed so a
 * workflow can replace it (per language) without a code change.
 *
 * Keys are stable public contracts once shipped (a workflow stores them), so a
 * key is never renamed or repurposed; a changed meaning gets a new key.
 */

/** One piece of copy. */
export interface TextEntry {
  /** `<group>.<element>` in lower camel segments, e.g. `document.capture.title`. */
  key: string;
  /** What the dashboard editor calls it, e.g. "Title". */
  label: string;
  /** The English default the SDK shows when the workflow sets nothing. */
  default: string;
  /** Long enough to deserve a multi-line field in the editor. */
  multiline?: boolean;
  /** Placeholders this text may use, e.g. ['count'] for `{count}`. Shown in the editor. */
  placeholders?: string[];
  /**
   * An older, dedicated config field that already holds this text (e.g.
   * `consent.title`). The editor reads and writes it there for English, so a
   * workflow saved before the catalogue keeps its copy and there is one source.
   */
  configPath?: string[];
  /** When the text is on screen; set on the customisable texts (see customisable.ts). */
  availability?: TextAvailability;
}

/** Who a workflow verifies. */
export type TextSubject = 'individual' | 'business';

/** An optional step a text belongs to; the editor hides it while the step is off. */
export type TextStep =
  | 'email'
  | 'phone'
  | 'contact'
  | 'documentCapture'
  | 'nfc'
  | 'liveness'
  | 'address'
  | 'proofOfAddress'
  | 'supportingDocuments'
  | 'questionnaire'
  | 'keyPeople'
  | 'businessDocuments'
  | 'applicant'
  | 'handoff';

/**
 * Where a text appears. Absent fields mean everywhere. `scopes` lists the
 * workflow scopes it shows on, with `full` for an unscoped workflow.
 */
export interface TextAvailability {
  subject?: TextSubject;
  scopes?: string[];
  step?: TextStep;
}

/** A screen, or a set of screens, as the dashboard editor groups them. */
export interface TextGroup {
  id: string;
  /** Section title in the editor, e.g. "Upload Document". */
  title: string;
  entries: TextEntry[];
}

/**
 * A workflow's custom copy: language (BCP-47, e.g. `en`, `fr`) to key to text.
 * Missing languages, keys and blank values all fall back to the default.
 */
export type WorkflowTexts = Record<string, Record<string, string>>;

/** Substitutions for `{name}` placeholders in a text. */
export type TextVars = Record<string, string | number | undefined | null>;

/**
 * Looks up a text by key, filling its placeholders. `legacy` is the value of
 * an older dedicated field (e.g. `consent.title`) that already held this text:
 * it wins over English custom copy and the default, but another language's own
 * text still wins in that language.
 */
export type TextFn = (key: string, vars?: TextVars, legacy?: string | null) => string;
