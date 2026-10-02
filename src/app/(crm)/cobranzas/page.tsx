import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { canManageCollections } from "@/lib/permissions";
import {
  getActiveClientsForSelect,
  getCurrencies,
  getDashboardSummary,
  getOperationsList,
  getProjectsList,
} from "@/modules/collections/data/queries";
import { CollectionsDashboard } from "@/modules/collections/components/CollectionsDashboard";

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; project?: string }>;
}) {
  const session = await getSession();
  if (!session || !canManageCollections(session)) notFound();

  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : "";
  const projectId = typeof params.project === "string" ? params.project : "";
  const page = Math.max(1, Number(params.page) || 1);

  const [summary, operationsPage, clients, currencies, projects] = await Promise.all([
    getDashboardSummary({ search, projectId: projectId || undefined }),
    getOperationsList({ page, search, projectId: projectId || undefined }),
    getActiveClientsForSelect(),
    getCurrencies(),
    getProjectsList(),
  ]);

  return (
    <CollectionsDashboard
      summary={summary}
      operationsPage={operationsPage}
      initialSearch={search}
      initialProject={projectId}
      clients={clients}
      currencies={currencies}
      projects={projects}
    />
  );
}
