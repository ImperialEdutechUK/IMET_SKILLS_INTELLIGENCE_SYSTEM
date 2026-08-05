/**
 * The password rules, once, for every form that sets a password.
 *
 * Mirrors backend/src/lib/password-policy.ts. Three screens (register,
 * set-password, settings) each had their own inline copy of the checks, and they
 * had already drifted — settings checked nothing at all and promised only "at
 * least 8 characters", which stopped being the whole truth when the server
 * policy gained lower-case, length-ceiling, common-password and
 * contains-your-name rules.
 *
 * This is UX, never a control. The server re-validates everything; the point
 * here is that the checklist cannot show all-green and then be rejected.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export interface PasswordRule {
  label: string;
  ok: boolean;
}

/**
 * The live checklist for a candidate password.
 *
 * The server additionally rejects common passwords and any password containing
 * the user's own name or email. Those are not shown as checkboxes — they would
 * be noise on every keystroke — and arrive as an error message instead.
 */
export function passwordRules(value: string): PasswordRule[] {
  return [
    {
      label: `${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters`,
      ok: value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH,
    },
    { label: "One uppercase letter", ok: /[A-Z]/.test(value) },
    { label: "One lowercase letter", ok: /[a-z]/.test(value) },
    { label: "One number", ok: /\d/.test(value) },
  ];
}

/** True when every rule this form can check client-side is satisfied. */
export function passwordMeetsRules(value: string): boolean {
  return passwordRules(value).every((r) => r.ok);
}

/** Placeholder text that states the real requirement rather than half of it. */
export const PASSWORD_HINT = "8+ characters, upper & lower case, and a number";
