import {
  BarChart3,
  FileSpreadsheet,
  Mic,
  Presentation,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { canAccessRetail, canUser, type StaffUser } from "@/lib/permissions";

export type TriModule = {
  id: string;
  title: string;
  shortLabel: string;
  tagline: string;
  description: string;
  href: string;
  icon: LucideIcon;
  features: string[];
  category: string;
  /** Who may open it; everyone when absent. */
  allowed?: (user: StaffUser) => boolean;
};


/** All TRI modules available in the launcher */
export const TRI_MODULES: TriModule[] = [
  {
    id: "reports",
    allowed: canAccessRetail,
    title: "Retail Interface",
    shortLabel: "Interface",
    tagline: "Performance · Insights · Archive",
    description:
      "Retail performance intelligence with filters, archives, and expandable fuel / non-fuel frameworks.",
    href: "/intelligence/retail",
    icon: FileSpreadsheet,
    category: "Intelligence",
    features: [
      "Dealer order analytics dashboard",
      "Station-first dealer & staff invites",
      "Realtime messaging",
      "Retail operations workspace",
    ],
  },
  {
    id: "note-taker",
    title: "AI Note Taker",
    shortLabel: "Notes",
    tagline: "Capture · Structure · Action",
    description:
      "AI-powered meeting capture with recording sessions, structured notes, and executive archives.",
    href: "/intelligence/note-taker",
    icon: Mic,
    category: "Intelligence",
    features: [
      "Instant & scheduled sessions",
      "Live recording workspace",
      "Structured meeting notes",
      "Whisper / AI pipeline ready",
    ],
  },
  {
    id: "presentations",
    title: "Presentations",
    shortLabel: "Decks",
    tagline: "Brief · Present · Decide",
    description:
      "Convert meeting notes into board-ready decks with fullscreen mode and keyboard navigation.",
    href: "/intelligence/presentations",
    icon: Presentation,
    category: "Intelligence",
    features: [
      "Notes-to-deck generation",
      "Executive slide structure",
      "Fullscreen presentation mode",
      "Keyboard slide navigation",
    ],
  },
  {
    id: "users",
    allowed: (user) => canUser(user, "adminUsers", "view"),
    title: "Users",
    shortLabel: "Users",
    tagline: "Provision · Manage · Control",
    description: "Admin user provisioning, invites, and access control.",
    href: "/intelligence/admin/users",
    icon: Users,
    category: "Admin",
    features: [
      "Create and invite users",
      "Disable or delete accounts",
      "Role & permissions management",
      "Password reset invites",
    ],
  },
  {
    id: "activity",
    allowed: (user) => canUser(user, "activity", "view"),
    title: "Activity Logs",
    shortLabel: "Activity",
    tagline: "Monitor · Audit · Trace",
    description: "System activity across login, modules, and admin actions.",
    href: "/intelligence/admin/activity",
    icon: BarChart3,
    category: "Admin",
    features: [
      "Recent platform activity",
      "Actor and entity tracing",
      "Audit-friendly history",
      "Security visibility",
    ],
  },
  {
    id: "settings",
    allowed: (user) => canUser(user, "settings", "view"),
    title: "Settings",
    shortLabel: "Settings",
    tagline: "Configure · Connect · Secure",
    description: "Platform configuration for email, storage, and AI connectors.",
    href: "/intelligence/admin/settings",
    icon: Settings,
    category: "Admin",
    features: [
      "Environment overview",
      "Email connector status",
      "Storage hooks",
      "AI pipeline readiness",
    ],
  },
];

export const FEATURED_MODULES = TRI_MODULES.filter((m) =>
  ["reports", "note-taker", "presentations"].includes(m.id)
);

/** The tiles a role may open (the dashboard and launcher show only these). */
export function visibleModules(user: StaffUser): TriModule[] {
  return TRI_MODULES.filter((module) => !module.allowed || module.allowed(user));
}
