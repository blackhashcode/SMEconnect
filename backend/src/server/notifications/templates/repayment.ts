export type RepaymentEmailKind = "DUE" | "OVERDUE" | "MARKED_PAID" | "CONFIRMED";
export type RepaymentRecipientRole = "OWNER" | "INVESTOR";

export interface RepaymentEmailInput {
  loanId: string;
  repaymentId: string;
  installmentNo: number;
  amountBdt: number;
  dueDate: string;
  recipientRole: RepaymentRecipientRole;
  note?: string | null;
}

export interface RepaymentEmail {
  subject: string;
  text: string;
  html: string;
}

const COPY: Record<
  RepaymentEmailKind,
  Record<RepaymentRecipientRole, { subject: string; intro: string }>
> = {
  DUE: {
    OWNER: {
      subject: "Repayment due in 2 days",
      intro: "Your next SME Connect installment is due in 2 days.",
    },
    INVESTOR: {
      subject: "Borrower repayment due in 2 days",
      intro: "An SME Connect borrower has an installment due in 2 days.",
    },
  },
  OVERDUE: {
    OWNER: {
      subject: "Repayment overdue",
      intro: "An SME Connect installment is now overdue.",
    },
    INVESTOR: {
      subject: "Borrower repayment overdue",
      intro: "An SME Connect borrower has an overdue installment.",
    },
  },
  MARKED_PAID: {
    OWNER: {
      subject: "Repayment marked as paid",
      intro: "Your repayment was marked as paid and is awaiting investor confirmation.",
    },
    INVESTOR: {
      subject: "Borrower marked a repayment as paid",
      intro: "The borrower marked an installment as paid. Please review and confirm receipt.",
    },
  },
  CONFIRMED: {
    OWNER: {
      subject: "Repayment confirmed",
      intro: "The investor confirmed receipt of your installment.",
    },
    INVESTOR: {
      subject: "Repayment confirmation recorded",
      intro: "You confirmed receipt of the borrower's installment.",
    },
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Small, dependency-free renderer shared by repayment events and reminder jobs. */
export function renderRepaymentEmail(
  kind: RepaymentEmailKind,
  input: RepaymentEmailInput,
): RepaymentEmail {
  const copy = COPY[kind][input.recipientRole];
  const safeNote = input.note ? escapeHtml(input.note) : null;
  const detailLines = [
    `Installment: ${input.installmentNo}`,
    `Amount: ৳${input.amountBdt.toLocaleString("en-BD")}`,
    `Due date: ${input.dueDate}`,
  ];
  if (safeNote) detailLines.push(`Note: ${input.note}`);

  return {
    subject: copy.subject,
    text: [copy.intro, ...detailLines, `Loan: ${input.loanId}`].join("\n"),
    html: [
      "<div>",
      `<p>${escapeHtml(copy.intro)}</p>`,
      "<ul>",
      `<li>Installment: ${input.installmentNo}</li>`,
      `<li>Amount: ৳${input.amountBdt.toLocaleString("en-BD")}</li>`,
      `<li>Due date: ${escapeHtml(input.dueDate)}</li>`,
      ...(safeNote ? [`<li>Note: ${safeNote}</li>`] : []),
      `</ul><p>Loan: ${escapeHtml(input.loanId)}</p>`,
      "</div>",
    ].join(""),
  };
}
