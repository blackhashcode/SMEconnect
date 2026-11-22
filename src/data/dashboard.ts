export const repaymentTrend = [
  { month: "Jan", principal: 18, return: 5 },
  { month: "Feb", principal: 22, return: 7 },
  { month: "Mar", principal: 26, return: 8 },
  { month: "Apr", principal: 30, return: 10 },
  { month: "May", principal: 34, return: 11 },
  { month: "Jun", principal: 38, return: 13 },
];

export const sectorAllocation = [
  { label: "Food & cloud kitchens", share: 40, amount: 328000, color: "bg-primary" },
  { label: "Fashion & Jamdani", share: 30, amount: 246000, color: "bg-secondary-container" },
  { label: "Handicrafts & agro", share: 20, amount: 164000, color: "bg-tertiary-fixed-dim" },
  { label: "Tech & logistics", share: 10, amount: 82000, color: "bg-success" },
];

export const investorPortfolio = [
  { loanId: "lr-1", committed: 150000, role: "Lead investor", nextAmount: 12500, due: "14 Dec", cycle: "5 of 12", progress: 42, returnRate: 10.5, status: "On track" },
  { loanId: "lr-2", committed: 120000, role: "Direct investor", nextAmount: 10000, due: "22 Dec", cycle: "3 of 8", progress: 38, returnRate: 11, status: "On track" },
  { loanId: "lr-4", committed: 200000, role: "Lead investor", nextAmount: 16000, due: "28 Dec", cycle: "2 of 6", progress: 33, returnRate: 12, status: "Due soon" },
  { loanId: "lr-5", committed: 80000, role: "Direct investor", nextAmount: 7200, due: "18 Dec", cycle: "3 of 3", progress: 66, returnRate: 10, status: "Final cycle" },
];

export const businessMilestones = [
  { label: "Verification approved", done: true },
  { label: "Loan request published", done: true },
  { label: "First direct offer received", done: true },
  { label: "Agreement signed", done: false },
  { label: "First repayment recorded", done: false },
];
