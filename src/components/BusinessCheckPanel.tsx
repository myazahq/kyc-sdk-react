'use client';

// What the register said, when it was NOT a plain yes.
//
// The check is a paid, deliberate step, so it is shown rather than run
// invisibly: the applicant sees the business confirmed by name before they
// invest in documents and a selfie, and a company that is not on the register is
// caught here instead of after all that work.
import { SearchX, TriangleAlert } from './icons';
import type { BusinessCheckState } from '../context/types';
import { useText } from '../i18n';

export function BusinessCheckPanel({ check }: { check: BusinessCheckState }) {
  const t = useText();
  // `skipped` shows nothing on purpose. The organisation could not be charged,
  // which is not the applicant's problem and not something they can act on;
  // the check simply happens at submission instead. `checking` shows nothing
  // either — the loader lives inside the Continue button they just pressed,
  // not in a panel appearing elsewhere on the page.
  if (check.status === 'idle' || check.status === 'skipped' || check.status === 'checking') {
    return null;
  }

  if (check.status === 'not_found') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {t('business.check.notFoundTitle')}
          </p>
          <p className="text-amber-800 dark:text-amber-300">{t('business.check.notFoundBody')}</p>
        </div>
      </div>
    );
  }

  if (check.status === 'limit_reached') {
    // Not a failure: the submission still runs its own check. What it says is
    // "stop re-picking and look at the number", which is the only thing left
    // that helps.
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <p className="font-medium">{t('business.check.limitTitle')}</p>
        <p className="mt-1 text-muted-foreground">{t('business.check.limitBody')}</p>
      </div>
    );
  }

  if (check.status === 'unavailable') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          {/* Deliberately not "we could not find it": an outage is not evidence
              that a business is unregistered. */}
          <p className="font-medium">{t('business.check.unavailableTitle')}</p>
          <p className="text-muted-foreground">{t('business.check.unavailableBody')}</p>
        </div>
      </div>
    );
  }

  // Nothing is shown for a company that WAS found.
  //
  // The register's answer is already in the form the applicant is looking at:
  // the name, type and company details it returned are in the fields above,
  // editable, and its officers are the next step. Repeating all of it in a
  // panel underneath said the same thing twice and pushed the button off
  // screen. The states below stay because they are the only way somebody
  // learns the lookup did NOT go to plan.
  return null;
}
