import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main>
      <RegisterForm />
      <p>
        Have an account? <Link href="/login">Login</Link>
      </p>
    </main>
  );
}
