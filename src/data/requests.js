export const requests = [
  { 
    id: 1, employeeId: 1, employeeName: "Alice Mugisha", department: "Finance", 
    type: "Laptops", items: [{ name: "MacBook Pro 14\"", qty: 1 }], 
    urgency: "High", justification: "Current laptop screen damaged.", 
    status: "pending_head", 
    timeline: [
      { stage: "Request Submitted", actor: "Alice Mugisha", action: "Submitted", timestamp: "2023-10-24T10:00:00Z", note: "" }
    ], 
    createdAt: "2023-10-24T10:00:00Z" 
  },
  { 
    id: 2, employeeId: 5, employeeName: "Eve Ishimwe", department: "Engineering", 
    type: "Monitors", items: [{ name: "Dell Monitor 24\"", qty: 2 }], 
    urgency: "Medium", justification: "Need dual monitor setup for development.", 
    status: "pending_hr", 
    timeline: [
      { stage: "Request Submitted", actor: "Eve Ishimwe", action: "Submitted", timestamp: "2023-10-23T09:00:00Z", note: "" },
      { stage: "Head Approval", actor: "Engineering Head", action: "Approved", timestamp: "2023-10-23T11:00:00Z", note: "Approved for productivity." }
    ], 
    createdAt: "2023-10-23T09:00:00Z" 
  },
  { 
    id: 3, employeeId: 1, employeeName: "Alice Mugisha", department: "Finance", 
    type: "Peripherals", items: [{ name: "Logitech MX Keys", qty: 1 }], 
    urgency: "Low", justification: "Keyboard missing keys.", 
    status: "pending_ict", 
    timeline: [
      { stage: "Request Submitted", actor: "Alice Mugisha", action: "Submitted", timestamp: "2023-10-22T08:00:00Z", note: "" },
      { stage: "Head Approval", actor: "Bob Nkurunziza", action: "Approved", timestamp: "2023-10-22T10:00:00Z", note: "Approved." },
      { stage: "HR Approval", actor: "Clara Uwimana", action: "Approved", timestamp: "2023-10-22T14:00:00Z", note: "Employee eligible for replacement." }
    ], 
    createdAt: "2023-10-22T08:00:00Z" 
  },
  { 
    id: 4, employeeId: 5, employeeName: "Eve Ishimwe", department: "Engineering", 
    type: "Peripherals", items: [{ name: "External SSD 1TB", qty: 1 }], 
    urgency: "High", justification: "Project data requires offline backup.", 
    status: "approved", 
    timeline: [
      { stage: "Request Submitted", actor: "Eve Ishimwe", action: "Submitted", timestamp: "2023-10-21T09:00:00Z", note: "" },
      { stage: "Head Approval", actor: "Engineering Head", action: "Approved", timestamp: "2023-10-21T10:00:00Z", note: "Approved." },
      { stage: "HR Approval", actor: "Clara Uwimana", action: "Approved", timestamp: "2023-10-21T11:00:00Z", note: "Approved." },
      { stage: "ICT Approval", actor: "David Habimana", action: "Approved", timestamp: "2023-10-21T14:00:00Z", note: "SSD provisioned." }
    ], 
    createdAt: "2023-10-21T09:00:00Z" 
  },
  { 
    id: 5, employeeId: 1, employeeName: "Alice Mugisha", department: "Finance", 
    type: "Mobile", items: [{ name: "iPhone 13 Pro", qty: 1 }], 
    urgency: "Medium", justification: "Need work phone.", 
    status: "rejected", 
    timeline: [
      { stage: "Request Submitted", actor: "Alice Mugisha", action: "Submitted", timestamp: "2023-10-20T08:00:00Z", note: "" },
      { stage: "Head Approval", actor: "Bob Nkurunziza", action: "Rejected", timestamp: "2023-10-20T10:00:00Z", note: "Not required for current role." }
    ], 
    createdAt: "2023-10-20T08:00:00Z" 
  },
  { 
    id: 6, employeeId: 5, employeeName: "Eve Ishimwe", department: "Engineering", 
    type: "Laptops", items: [{ name: "MacBook Pro 14\"", qty: 1 }], 
    urgency: "Medium", justification: "Upgrading from older model.", 
    status: "pending_ict", 
    timeline: [
      { stage: "Request Submitted", actor: "Eve Ishimwe", action: "Submitted", timestamp: "2023-10-24T09:00:00Z", note: "" },
      { stage: "Head Approval", actor: "Engineering Head", action: "Approved", timestamp: "2023-10-24T10:00:00Z", note: "Approved." },
      { stage: "HR Approval", actor: "Clara Uwimana", action: "Approved", timestamp: "2023-10-24T11:00:00Z", note: "Approved." }
    ], 
    createdAt: "2023-10-24T09:00:00Z" 
  }
];
