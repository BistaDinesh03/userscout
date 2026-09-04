/* Auth — local accounts, PBKDF2-hashed passwords, honest about scope. */

import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../state/store";
import { AppError } from "../core/utils";
import { Button, Field, Input } from "../components/ui";
import { Logo } from "../components/layout";
import { ILock, IShield } from "../components/icons";
import { cx } from "../core/utils";

export default function AuthPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");
  const { auth, toast } = useWorkspace();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (username.trim().length < 3) errs.username = "At least 3 characters.";
    if (password.length < 8) errs.password = "Minimum 8 characters.";
    if (mode === "register" && confirm !== password) errs.confirm = "Passwords don't match.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (mode === "register") {
        await auth.register(username, password);
        toast("ok", "Workspace created — welcome aboard.");
      } else {
        await auth.login(username, password);
        toast("ok", "Signed in.");
      }
      nav("/app/projects", { replace: true });
    } catch (err) {
      const msg = err instanceof AppError ? err.message : "Something went wrong.";
      setErrors({ form: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-fog-500">private workspace · this device only</p>
        </div>

        <div className="brackets rounded-lg border border-pine-600 bg-pine-900/85 p-6 shadow-panel">
          <div className="mb-6 grid grid-cols-2 rounded-md border border-pine-700 bg-pine-950/60 p-1" role="tablist" aria-label="Authentication mode">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setErrors({}); }}
                className={cx("rounded px-3 py-1.5 text-[13px] font-medium transition-all", mode === m ? "bg-pine-700 text-signal-300" : "text-fog-400 hover:text-fog-100")}
              >
                {m === "login" ? "Sign in" : "Create workspace"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Username" error={errors.username}>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus placeholder="ada" invalid={!!errors.username} />
            </Field>
            <Field label="Password" error={errors.password} hint="min 8 chars">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" invalid={!!errors.password} />
            </Field>
            {mode === "register" && (
              <Field label="Confirm password" error={errors.confirm}>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="••••••••" invalid={!!errors.confirm} />
              </Field>
            )}
            {errors.form && (
              <p role="alert" className="rounded-md border border-ember-500/35 bg-ember-500/10 px-3 py-2 text-[12.5px] text-ember-400">{errors.form}</p>
            )}
            <Button type="submit" loading={busy} className="w-full">
              {mode === "login" ? "Sign in" : "Create workspace"}
            </Button>
          </form>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-pine-700/70 bg-pine-900/50 px-3.5 py-3 text-[11.5px] leading-relaxed text-fog-500">
          <IShield size={14} className="mt-px shrink-0 text-signal-400" />
          <span>
            Accounts are stored <strong className="text-fog-300">locally</strong> with PBKDF2-hashed passwords (150k iterations) — never plaintext.
            This local-first build demonstrates the full ownership model; pair it with the server adapter for multi-device use.
          </span>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center font-mono text-[10.5px] text-fog-500">
          <ILock size={11} /> no email required · no tracking · no server calls
        </p>
      </div>
    </div>
  );
}
