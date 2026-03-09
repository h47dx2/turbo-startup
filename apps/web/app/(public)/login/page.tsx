import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[61.11%_38.89%]">
      <section className="relative min-h-[52vh] overflow-hidden lg:min-h-screen">
        <div
          aria-hidden
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1659284994825-a7bd3b5c1804')] bg-cover bg-center"
        />
        <div className="relative z-10 flex flex-col gap-2 p-9">
          <p className="[font-family:var(--font-dm-sans),sans-serif] text-[24px] font-bold text-sky-300">
            TURBO STARTUP
          </p>
          <h1 className="max-w-[620px] [font-family:var(--font-bricolage),var(--font-dm-sans),sans-serif] text-[80px] leading-[1.04] font-bold whitespace-pre-line text-slate-50">
            {"Built for teams\nthat ship fast."}
          </h1>
          <p className="max-w-[620px] [font-family:var(--font-dm-sans),sans-serif] text-[20px] text-slate-200">
            A focused workspace for product, engineering, and growth.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-9 py-10 lg:px-[72px] lg:py-[136px]">
        <LoginForm />
      </section>
    </main>
  );
}
