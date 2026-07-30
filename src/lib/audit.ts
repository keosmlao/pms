import { pool } from "@/lib/db";

export type ActivityItem = {
  kind: "group" | "spare";
  at: string | null;
  by_name: string;
  by_code: string;
  target: string;
  detail: string;
};

// Recent activity from the app-owned mapping tables. Note: these hold current
// state (with assigned_by/created_by), so deletions are not recorded here — a
// full audit trail would need a dedicated log table + triggers.
export async function getRecentActivity(limit = 100, offset = 0): Promise<ActivityItem[]> {
  const { rows } = await pool.query<ActivityItem>(
    `(
       SELECT 'group' AS kind, r.assigned_at::text AS at,
              COALESCE(ab.fullname_lo, r.assigned_by, '') AS by_name,
              COALESCE(r.assigned_by, '') AS by_code,
              COALESCE(gm.name_1, r.group_main)
                || CASE WHEN r.group_sub <> '' THEN ' › ' || COALESCE(gs.name_1, r.group_sub) ELSE '' END AS target,
              COALESCE(e.fullname_lo, r.employee_code) AS detail
         FROM odg_group_responsible r
         LEFT JOIN odg_employee ab ON ab.employee_code = r.assigned_by
         LEFT JOIN odg_employee e ON e.employee_code = r.employee_code
         LEFT JOIN ic_group gm ON gm.code = r.group_main
         LEFT JOIN ic_group_sub gs ON gs.code = r.group_sub
     )
     UNION ALL
     (
       SELECT 'spare' AS kind, m.created_at::text AS at,
              COALESCE(cb.fullname_lo, m.created_by, '') AS by_name,
              COALESCE(m.created_by, '') AS by_code,
              m.spare_code || ' → ' || m.product_code AS target,
              COALESCE(i.name_1, '') AS detail
         FROM odg_product_spare_mapping m
         LEFT JOIN odg_employee cb ON cb.employee_code = m.created_by
         LEFT JOIN ic_inventory i ON i.code = m.product_code
     )
     ORDER BY at DESC NULLS LAST
     LIMIT ${limit} OFFSET ${Math.max(0, offset)}`,
  );
  return rows;
}
