"use client";

import { useState } from "react";
import ClientSelect from "@/components/ClientSelect";
import { saveCampaign } from "./actions";
import type { CategoryOption, DeptOption, EmployeeOption } from "@/lib/campaigns";

type TierDraft = { pct: string; target_qty: string; bonus_amount: string };
type LineDraft = {
  name: string;
  categories: string[];
  brands: string;
  unit_bonus_brands: string;
  unit_bonus_per_unit: string;
  tiers: TierDraft[];
};

export type CampaignDraft = {
  id?: number;
  name: string;
  description: string;
  date_from: string;
  date_to: string;
  scope_kind: "all" | "department" | "bu";
  scope_codes: string[];
  reward_currency: string;
  status: string;
  note: string;
  exclude_gifts: boolean;
  split_rule: string;
  fallback_employee_code: string;
  lines: LineDraft[];
};

const EMPTY_TIER: TierDraft = { pct: "100", target_qty: "", bonus_amount: "" };
const EMPTY_LINE: LineDraft = {
  name: "",
  categories: [],
  brands: "",
  unit_bonus_brands: "",
  unit_bonus_per_unit: "0",
  tiers: [{ ...EMPTY_TIER }],
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const labelCls = "block text-[11px] font-medium text-slate-500 dark:text-slate-400";

function splitList(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function CampaignForm({
  initial,
  categories,
  departments,
  employees,
}: {
  initial: CampaignDraft;
  categories: CategoryOption[];
  departments: DeptOption[];
  employees: EmployeeOption[];
}) {
  const [draft, setDraft] = useState<CampaignDraft>(initial);

  const catOptions = categories.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }));
  const deptOptions = departments.map((d) => ({ value: d.code, label: `${d.name} · ${d.bu_name} (${d.code})` }));
  const empOptions = employees.map((e) => ({ value: e.code, label: `${e.name} (${e.code})` }));

  function setLine(i: number, patch: Partial<LineDraft>) {
    setDraft((d) => ({ ...d, lines: d.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  }
  function setTier(li: number, ti: number, patch: Partial<TierDraft>) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, k) =>
        k === li ? { ...l, tiers: l.tiers.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : l,
      ),
    }));
  }

  const payload = JSON.stringify({
    id: draft.id,
    name: draft.name,
    description: draft.description,
    date_from: draft.date_from,
    date_to: draft.date_to,
    scope_kind: draft.scope_kind,
    scope_codes: draft.scope_codes,
    reward_currency: draft.reward_currency,
    status: draft.status,
    note: draft.note,
    exclude_gifts: draft.exclude_gifts,
    split_rule: draft.split_rule,
    fallback_employee_code: draft.fallback_employee_code,
    lines: draft.lines.map((l) => ({
      name: l.name,
      categories: l.categories,
      brands: splitList(l.brands),
      unit_bonus_brands: splitList(l.unit_bonus_brands),
      unit_bonus_per_unit: Number(l.unit_bonus_per_unit || 0),
      tiers: l.tiers.map((t) => ({
        pct: Number(t.pct || 0),
        target_qty: Number(t.target_qty || 0),
        bonus_amount: Number(t.bonus_amount || 0),
      })),
    })),
  });

  return (
    <form action={saveCampaign} className="mt-5 space-y-5">
      <input type="hidden" name="payload" value={payload} />

      <div className="glass rounded-xl p-5">
        <p className="text-sm font-bold text-slate-900 dark:text-white">ຂໍ້ມູນໂຄງການ</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>ຊື່ໂຄງການ *</label>
            <input className={`${inputCls} mt-1`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </div>
          <div>
            <label className={labelCls}>ວັນທີເລີ່ມ *</label>
            <input type="date" className={`${inputCls} mt-1`} value={draft.date_from} onChange={(e) => setDraft({ ...draft, date_from: e.target.value })} required />
          </div>
          <div>
            <label className={labelCls}>ວັນທີສິ້ນສຸດ *</label>
            <input type="date" className={`${inputCls} mt-1`} value={draft.date_to} onChange={(e) => setDraft({ ...draft, date_to: e.target.value })} required />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ລາຍລະອຽດ / ເງື່ອນໄຂ</label>
            <textarea className={`${inputCls} mt-1`} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>ຂອບເຂດ</label>
            <select
              className={`${inputCls} mt-1`}
              value={draft.scope_kind}
              onChange={(e) => setDraft({ ...draft, scope_kind: e.target.value as CampaignDraft["scope_kind"], scope_codes: [] })}
            >
              <option value="all">ທຸກພະແນກ</option>
              <option value="department">ສະເພາະພະແນກ</option>
              <option value="bu">ສະເພາະ BU</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>ວິທີແບ່ງເງິນໃຫ້ພະນັກງານ</label>
            <select className={`${inputCls} mt-1`} value={draft.split_rule} onChange={(e) => setDraft({ ...draft, split_rule: e.target.value })}>
              <option value="prorata">ແບ່ງຕາມສັດສ່ວນຍອດຂາຍ</option>
              <option value="equal">ແບ່ງເທົ່າກັນທຸກຄົນທີ່ມີຍອດ</option>
              <option value="none">ບໍ່ແບ່ງ — ເປັນເງິນທີມ</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>ສະກຸນເງິນລາງວັນ</label>
            <select className={`${inputCls} mt-1`} value={draft.reward_currency} onChange={(e) => setDraft({ ...draft, reward_currency: e.target.value })}>
              <option value="THB">ບາດ (THB)</option>
              <option value="LAK">ກີບ (LAK)</option>
            </select>
          </div>
          {draft.scope_kind !== "all" ? (
            <div className="sm:col-span-2">
              <label className={labelCls}>{draft.scope_kind === "department" ? "ເລືອກພະແນກ" : "ລະຫັດ BU (ພິມແຍກດ້ວຍຈຸດ)"}</label>
              {draft.scope_kind === "department" ? (
                <div className="mt-1">
                  <ClientSelect
                    isMulti
                    options={deptOptions}
                    value={deptOptions.filter((o) => draft.scope_codes.includes(o.value))}
                    onChange={(vals) => setDraft({ ...draft, scope_codes: vals.map((v) => v.value) })}
                    placeholder="ເລືອກພະແນກ…"
                    classNamePrefix="rs"
                  />
                </div>
              ) : (
                <input className={`${inputCls} mt-1`} value={draft.scope_codes.join(", ")} onChange={(e) => setDraft({ ...draft, scope_codes: splitList(e.target.value) })} placeholder="11, 15" />
              )}
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className={labelCls}>ຫົວໜ້າທີມ (ຮັບຍອດຂອງຄົນທີ່ຈັບຄູ່ຊື່ໃນບິນບໍ່ໄດ້)</label>
            <div className="mt-1">
              <ClientSelect
                isClearable
                options={empOptions}
                value={empOptions.find((o) => o.value === draft.fallback_employee_code) ?? null}
                onChange={(v) => setDraft({ ...draft, fallback_employee_code: v?.value ?? "" })}
                placeholder="ເລືອກຫົວໜ້າທີມ…"
                classNamePrefix="rs"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={draft.exclude_gifts}
                onChange={(e) => setDraft({ ...draft, exclude_gifts: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-teal-600"
              />
              ນັບສະເພາະຕົວທີ່ຂາຍຈິງ — ຕັດຂອງແຖມ (ລາຄາ 0 ຫຼື ກຸ່ມ 98) ອອກຈາກຍອດ
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>ໝາຍເຫດ (ເງື່ອນໄຂການເບີກ)</label>
            <input className={`${inputCls} mt-1`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </div>
        </div>
      </div>

      {draft.lines.map((line, li) => (
        <div key={li} className="glass rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900 dark:text-white">ໝວດທີ {li + 1}</p>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, k) => k !== li) })}
              className="text-[11px] font-medium text-red-600 hover:underline"
            >
              ລຶບໝວດນີ້
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>ຊື່ໝວດ *</label>
              <input className={`${inputCls} mt-1`} value={line.name} onChange={(e) => setLine(li, { name: e.target.value })} placeholder="ເຊັ່ນ ໝໍ້ຫຸງເຂົ້າ" />
            </div>
            <div>
              <label className={labelCls}>ກັ່ນຕອງແບຣນ (ວ່າງ = ທຸກແບຣນ)</label>
              <input className={`${inputCls} mt-1`} value={line.brands} onChange={(e) => setLine(li, { brands: e.target.value })} placeholder="MIDEA, SHARP" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>ໝວດສິນຄ້າທີ່ນັບເຂົ້າເປົ້າ *</label>
              <div className="mt-1">
                <ClientSelect
                  isMulti
                  options={catOptions}
                  value={catOptions.filter((o) => line.categories.includes(o.value))}
                  onChange={(vals) => setLine(li, { categories: vals.map((v) => v.value) })}
                  placeholder="ເລືອກໝວດສິນຄ້າ…"
                  classNamePrefix="rs"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>ແບຣນທີ່ໄດ້ໂບນັດຕໍ່ຕົວ</label>
              <input className={`${inputCls} mt-1`} value={line.unit_bonus_brands} onChange={(e) => setLine(li, { unit_bonus_brands: e.target.value })} placeholder="MIDEA" />
            </div>
            <div>
              <label className={labelCls}>ໂບນັດຕໍ່ຕົວ</label>
              <input type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={line.unit_bonus_per_unit} onChange={(e) => setLine(li, { unit_bonus_per_unit: e.target.value })} />
            </div>
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">ຂັ້ນເປົ້າ ແລະ ໂບນັດ</p>
          <div className="mt-2 space-y-2">
            {line.tiers.map((t, ti) => (
              <div key={ti} className="grid grid-cols-[70px_1fr_1fr_auto] items-end gap-2">
                <div>
                  <label className={labelCls}>%</label>
                  <input type="number" className={`${inputCls} mt-1`} value={t.pct} onChange={(e) => setTier(li, ti, { pct: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>ເປົ້າ (ໜ່ວຍ)</label>
                  <input type="number" min="0" className={`${inputCls} mt-1`} value={t.target_qty} onChange={(e) => setTier(li, ti, { target_qty: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>ໂບນັດ</label>
                  <input type="number" min="0" className={`${inputCls} mt-1`} value={t.bonus_amount} onChange={(e) => setTier(li, ti, { bonus_amount: e.target.value })} />
                </div>
                <button
                  type="button"
                  onClick={() => setLine(li, { tiers: line.tiers.filter((_, j) => j !== ti) })}
                  className="mb-1 px-2 text-xs text-slate-400 hover:text-red-600"
                  aria-label="ລຶບຂັ້ນ"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLine(li, { tiers: [...line.tiers, { ...EMPTY_TIER }] })}
            className="mt-2 text-[11px] font-medium text-teal-600 hover:underline"
          >
            + ເພີ່ມຂັ້ນ
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDraft({ ...draft, lines: [...draft.lines, { ...EMPTY_LINE, tiers: [{ ...EMPTY_TIER }] }] })}
          className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-500 hover:text-teal-600 dark:border-slate-600 dark:text-slate-300"
        >
          + ເພີ່ມໝວດສິນຄ້າ
        </button>
        <button type="submit" className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700">
          ບັນທຶກ
        </button>
      </div>
    </form>
  );
}
