"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "Login failed");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[416px] p-0">
      <span className="sr-only">Login</span>
      <h1 className="[font-family:var(--font-bricolage),var(--font-dm-sans),sans-serif] text-[38px] font-bold text-slate-900">
        Sign in
      </h1>
      <p className="mt-1 [font-family:var(--font-dm-sans),sans-serif] text-[15px] text-slate-500">
        Use your work email and password to continue.
      </p>

      <form className="mt-8 space-y-8" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="[font-family:var(--font-dm-sans),sans-serif] text-[13px] font-semibold text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            className="w-full rounded-xl border-0 bg-slate-50 px-4 py-[14px] [font-family:var(--font-dm-sans),sans-serif] text-[14px] text-slate-400 ring-1 ring-transparent outline-none focus:ring-blue-500"
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="[font-family:var(--font-dm-sans),sans-serif] text-[13px] font-semibold text-slate-700" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              className="w-full rounded-xl border-0 bg-slate-50 px-4 py-[14px] pr-11 [font-family:var(--font-dm-sans),sans-serif] text-[14px] text-slate-400 ring-1 ring-transparent outline-none focus:ring-blue-500"
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {showPassword ? <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.75} /> : <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <button
          className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-[14px] [font-family:var(--font-dm-sans),sans-serif] text-[14px] font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>

        <button
          className="flex w-full items-center justify-center rounded bg-white px-3 py-2.5"
          type="button"
          aria-label="Sign in with Google (coming soon)"
        >
          <span className="inline-flex items-center gap-2">
            <svg aria-hidden viewBox="0 0 18 18" className="h-4 w-4">
              <path
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.36 0-4.36-1.59-5.08-3.73H.92v2.34A9 9 0 0 0 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.92 10.69A5.4 5.4 0 0 1 3.64 9c0-.59.1-1.15.28-1.69V4.97H.92A9 9 0 0 0 0 9c0 1.45.35 2.82.92 4.03l3-2.34z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .92 4.97l3 2.34C4.64 5.17 6.64 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            <span className="[font-family:var(--font-roboto),var(--font-dm-sans),sans-serif] text-[14px] font-medium text-[#3C4043]">
              Sign in with Google
            </span>
          </span>
        </button>
      </form>

      <p className="mt-8 [font-family:var(--font-dm-sans),sans-serif] text-[13px] font-medium text-slate-600">
        No account yet?{" "}
        <Link href="/register" className="text-[13px] font-semibold text-blue-600 hover:text-blue-500">
          Create one
        </Link>
      </p>
    </div>
  );
}
