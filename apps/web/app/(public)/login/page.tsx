import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main>
      <LoginForm />
      <p>
        No account? <Link href="/register">Register</Link>
      </p>
    </main>
  );
}
