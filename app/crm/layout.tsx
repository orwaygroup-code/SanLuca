import { CrmShell } from "@/components/crm/CrmShell";

export const metadata = { title: "CRM | San Luca", manifest: "/api/manifest?start=/crm" };

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
