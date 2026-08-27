import { and, desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { activityLog } from "@/db/schema/activityLog"
import { users } from "@/db/schema/user"
import type { ActivityEntry } from "@/types/activity"

type ActivityEntityType = "task"
type ActivityAction = "created" | "updated" | "status_changed"

interface LogActivityParams {
  entityType: ActivityEntityType
  entityId: string
  action: ActivityAction
  description: string
  userId: string
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  await db.insert(activityLog).values(params)
}

export async function getActivity(
  entityType: ActivityEntityType,
  entityId: string,
  limit = 50,
): Promise<ActivityEntry[]> {
  const rows = await db
    .select({
      id: activityLog.id,
      description: activityLog.description,
      userName: users.name,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .innerJoin(users, eq(activityLog.userId, users.id))
    .where(and(eq(activityLog.entityType, entityType), eq(activityLog.entityId, entityId)))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)

  return rows
}
