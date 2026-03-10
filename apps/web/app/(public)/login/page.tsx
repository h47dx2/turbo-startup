import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[61.11%_38.89%]">
      <section className="relative h-80 overflow-hidden lg:min-h-screen">
        <div
          aria-hidden
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1659284994825-a7bd3b5c1804')] bg-cover bg-center"
        />
        <div className="relative z-10 flex h-full flex-col justify-end gap-2 px-5 py-6 lg:h-auto lg:justify-start lg:p-9">
          <p className="[font-family:var(--font-dm-sans),sans-serif] text-[14px] font-bold text-sky-300 lg:text-[24px]">
            TURBO STARTUP
          </p>
          <h1 className="max-w-82.5 [font-family:var(--font-bricolage),var(--font-dm-sans),sans-serif] text-[46px] leading-[1.02] font-bold whitespace-pre-line text-slate-50 lg:max-w-155 lg:text-[80px] lg:leading-[1.04]">
            {"Built for teams\nthat ship fast."}
          </h1>
          <p className="max-w-75 [font-family:var(--font-dm-sans),sans-serif] text-[14px] text-slate-200 lg:max-w-155 lg:text-[20px]">
            A focused workspace for product, engineering, and growth.
          </p>
        </div>
      </section>

      <section className="flex items-start bg-white px-4 pt-5 pb-8 lg:min-h-screen lg:items-center lg:justify-center lg:px-18 lg:py-34">
        <LoginForm />
      </section>
    </main>
  );
}
