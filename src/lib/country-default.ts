/**
 * Which country to assume for a field nobody has answered.
 *
 * One rule, one order, so two screens cannot quietly disagree about what
 * "default country" means:
 *
 *   1. what somebody actually CHOSE or entered
 *   2. what the flow already knows (the register being checked, the workflow's
 *      configured country) - a fact about this verification
 *   3. the visitor's IP - a guess about this person
 *   4. nothing
 *
 * The IP sits below the flow's own knowledge and above a hardcoded constant. A
 * Nigerian company's phone number is Nigerian wherever its director happens to
 * be sitting, so the register outranks the address they connected from; but a
 * blank field with no other signal is better served by where they are than by
 * whichever country the last developer typed in.
 *
 * It is only ever a DEFAULT. Nothing branches on it, it never reaches a
 * verification as evidence, and a VPN making it wrong costs one correction.
 * Device Intelligence carries the same lookup as a RISK signal; the two must
 * not be confused.
 */
export function defaultCountry(...candidates: (string | null | undefined)[]): string | undefined {
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v.toUpperCase();
  }
  return undefined;
}
