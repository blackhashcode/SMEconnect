import { AppShell } from "@/components/layout/AppShell";
import { LoanRequestForm } from "@/components/domain/LoanRequestForm";

export const metadata = { title: "Create loan request" };

export default function NewLoanRequestPage() {
  return (
    <AppShell>
      <LoanRequestForm />
    </AppShell>
  );
}
