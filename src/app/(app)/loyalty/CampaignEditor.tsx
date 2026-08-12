"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveCampaignHeader, type ConfigActionState } from "./actions";
import type { ChannelOption } from "@/lib/loyalty-config";

const initial: ConfigActionState = { error: null, success: null };

const FIELD =
  "h-9 w-full rounded-lg glass px-2.5 text-xs text-slate-900 outline-none transition focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const LABEL = "mb-1 block text-[10px] font-medium text-slate-500 dark:text-slate-400";

export type EditableCampaign = {
  pro_code: string;
  pro_name: string;
  channel_group: string;
  from_date: string;
  to_date: string;
  start_exchange: string | null;
  end_exchange: string | null;
  is_active: number;
  is_redeem: number;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "..." : "ບັນທຶກ"}
    </button>
  );
}

// Only the control fields are editable. Item lines and point values stay with
// the promotion system that owns them, so nothing here can silently change how
// many points a past sale earned.
export default function CampaignEditor({
  campaign,
  channels,
}: {
  campaign: EditableCampaign;
  channels: ChannelOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveCampaignHeader, initial);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-teal-700 hover:underline dark:text-teal-400"
      >
        ແກ້ໄຂ
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900/50 dark:bg-teal-950/10">
      <form action={action}>
        <input type="hidden" name="pro_code" value={campaign.pro_code} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor={`ch-${campaign.pro_code}`}>ຊ່ອງທາງ</label>
            <select id={`ch-${campaign.pro_code}`} name="channel_group" defaultValue={campaign.channel_group} className={FIELD}>
              <option value="">— ບໍ່ກຳນົດ —</option>
              {channels.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor={`fd-${campaign.pro_code}`}>ເລີ່ມສະສົມ</label>
            <input id={`fd-${campaign.pro_code}`} type="date" name="from_date" defaultValue={campaign.from_date} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor={`td-${campaign.pro_code}`}>ສິ້ນສຸດສະສົມ</label>
            <input id={`td-${campaign.pro_code}`} type="date" name="to_date" defaultValue={campaign.to_date} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor={`sx-${campaign.pro_code}`}>ເລີ່ມແລກ</label>
            <input id={`sx-${campaign.pro_code}`} type="date" name="start_exchange" defaultValue={campaign.start_exchange ?? ""} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor={`ex-${campaign.pro_code}`}>ສິ້ນສຸດແລກ</label>
            <input id={`ex-${campaign.pro_code}`} type="date" name="end_exchange" defaultValue={campaign.end_exchange ?? ""} className={FIELD} />
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="is_active" defaultChecked={campaign.is_active === 1} className="h-4 w-4 accent-teal-600" />
              ໃຊ້ງານ
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="is_redeem" defaultChecked={campaign.is_redeem === 1} className="h-4 w-4 accent-teal-600" />
              ແລກໄດ້
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <SaveButton />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300"
          >
            ປິດ
          </button>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            ແກ້ໄດ້ພຽງວັນທີ ແລະ ສະຖານະ — ລາຍການສິນຄ້າ ແລະ ຄະແນນ ຍັງເປັນຂອງລະບົບໂປຣໂມຊັ່ນ
          </span>
        </div>
        {(state.error || state.success) && (
          <p className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-medium ${state.error ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300"}`}>
            {state.error ?? state.success}
          </p>
        )}
      </form>
    </div>
  );
}
