"use client";

import {
  ArrowCounterClockwise, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Binoculars, Brain, CalendarBlank, ChartBar, Chat, ChatText,
  Check, CheckCircle, CircleNotch, Clock, CreditCard, Envelope, FileText, FlowArrow, Folder, FolderOpen, FolderSimple, Kanban,
  Lightning, List, ListChecks, MagnifyingGlass, Moon, Paperclip, PaperPlaneTilt, Pause, PencilLine, PencilSimple, Play, Plug,
  Receipt, ShieldCheck, Sparkle, Sun, Table, Tag, Tray, UserPlus, WarningCircle, X, XCircle,
} from "@phosphor-icons/react";

// One icon family for the whole site (Phosphor). The page asks for icons by short names;
// this table says which Phosphor icon each name means. To swap one icon, change it here.
const ICONS = {
  Search: MagnifyingGlass, Telescope: Binoculars, Brain, Receipt, FileBarChart: ChartBar, Inbox: Tray, Clock, CreditCard,
  PenLine: PencilLine, Send: PaperPlaneTilt, Table, FileText, Mail: Envelope, Tags: Tag, FolderInput: FolderSimple, Bell,
  Zap: Lightning, Sparkles: Sparkle, CircleCheck: CheckCircle, Paperclip, X, Loader2: CircleNotch, ArrowUp, Workflow: FlowArrow,
  Check, Pencil: PencilSimple, RotateCcw: ArrowCounterClockwise, ArrowRight, ArrowDown, ArrowLeft, Sun, Moon, Menu: List,
  MessageSquareText: ChatText, ListChecks, Play, Pause, Folder, FolderOpen, CircleAlert: WarningCircle, Calendar: CalendarBlank,
  MessageSquare: Chat, ListTodo: Kanban, CircleX: XCircle, ShieldCheck, Plug, UserPlus,
};

export function Icon({ name, size = 16, className = "", weight = "regular" }) {
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component size={size} weight={weight} className={className} aria-hidden="true" />;
}
