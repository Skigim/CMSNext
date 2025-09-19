import { CaseData } from "../types/case";

export const mockCases: CaseData[] = [
  {
    id: "1",
    name: "Ryley Goldner",
    mcn: "Z20618d",
    status: "In Progress",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-20"),
    resources: [
      {
        id: "r1",
        name: "Checking",
        amount: 50.00,
        status: "VR Pending",
        description: "Example Bank"
      }
    ],
    income: [
      {
        id: "i1",
        name: "Income",
        amount: 50.00,
        status: "UI Pending",
        description: "Regular"
      }
    ],
    expenses: [
      {
        id: "e1",
        name: "Rent",
        amount: 50.00,
        status: "UI Pending",
        description: "House"
      }
    ],
    notes: ["Case opened for vocational rehabilitation assessment"]
  },
  {
    id: "2",
    name: "Sarah Johnson",
    mcn: "Z20619a",
    status: "Priority",
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-18"),
    resources: [
      {
        id: "r2",
        name: "Savings",
        amount: 1200.00,
        status: "Approved",
        description: "Main savings account"
      }
    ],
    income: [
      {
        id: "i2",
        name: "Disability Benefits",
        amount: 800.00,
        status: "Approved",
        description: "Monthly SSDI"
      }
    ],
    expenses: [
      {
        id: "e2",
        name: "Medical Bills",
        amount: 350.00,
        status: "In Progress",
        description: "Physical therapy"
      }
    ],
    notes: ["Priority case due to urgent financial needs", "Medical documentation received"]
  },
  {
    id: "3",
    name: "Michael Chen",
    mrn: "Z20620b",
    status: "Review",
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-22"),
    resources: [
      {
        id: "r3",
        name: "Investment Account",
        amount: 5000.00,
        status: "VR Pending",
        description: "401k rollover"
      }
    ],
    income: [
      {
        id: "i3",
        name: "Part-time Work",
        amount: 1200.00,
        status: "Completed",
        description: "Consulting work"
      }
    ],
    expenses: [
      {
        id: "e3",
        name: "Transportation",
        amount: 200.00,
        status: "Approved",
        description: "Modified vehicle payment"
      }
    ],
    notes: ["Case ready for final review", "All documentation complete"]
  }
];