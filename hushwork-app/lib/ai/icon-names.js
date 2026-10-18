// The icons a plan step may use: the ones an AI-written plan may pick AND the ones the step editor offers. A plain list
// with no imports, so Node tests and the browser can both load it. Every name must exist in components/icons.js
// (plan.test.js checks that). Icons made only for buttons and arrows are left out on purpose.
export const ICON_NAMES = [
  "Search", "Telescope", "Brain", "Receipt", "FileBarChart", "Inbox", "Clock", "CreditCard", "PenLine", "Send", "Table",
  "FileText", "Mail", "Tags", "FolderInput", "Bell", "Zap", "Sparkles", "CircleCheck", "Pencil", "MessageSquareText",
  "ListChecks", "Folder", "FolderOpen", "Calendar", "MessageSquare", "ListTodo", "ShieldCheck", "Plug", "UserPlus",
  "Workflow", "History",
];

// The plain words the step editor shows for each icon (the names above are code names). Same 32 keys as ICON_NAMES.
export const ICON_LABELS = {
  Search: "Search", Telescope: "Research", Brain: "Think", Receipt: "Invoice", FileBarChart: "Report", Inbox: "Inbox",
  Clock: "Schedule", CreditCard: "Payment", PenLine: "Write", Send: "Send", Table: "Table", FileText: "Document",
  Mail: "Email", Tags: "Labels", FolderInput: "File away", Bell: "Remind", Zap: "Quick action", Sparkles: "Sparkle",
  CircleCheck: "Check", Pencil: "Edit", MessageSquareText: "Message", ListChecks: "Checklist", Folder: "Folder",
  FolderOpen: "Open folder", Calendar: "Calendar", MessageSquare: "Chat", ListTodo: "To-do", ShieldCheck: "Approve",
  Plug: "Plug", UserPlus: "New person", Workflow: "Flow", History: "History",
};
