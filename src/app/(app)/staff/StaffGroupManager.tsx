"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Select from "@/components/ClientSelect";
import {
  assignGroupResponsibility,
  removeGroupResponsibility,
  type GroupActionState,
} from "./actions";
import type { GroupAssignment, GroupOption, StaffWithGroups } from "@/lib/products";

const initial: GroupActionState = { error: null, success: null };
type Opt = { value: string; label: string };

const selectClassNames = {
  control: ({ isFocused }: { isFocused: boolean }) =>
    [
      "min-h-10 rounded-lg border bg-white px-1 text-sm transition dark:bg-slate-950",
      isFocused ? "border-teal-400" : "border-slate-200 dark:border-slate-700",
    ].join(" "),
  valueContainer: () => "px-2 py-0.5",
  placeholder: () => "text-slate-400",
  input: () => "text-slate-900 dark:text-white",
  singleValue: () => "text-slate-900 dark:text-white",
  indicatorsContainer: () => "text-slate-400",
  dropdownIndicator: () => "px-1",
  clearIndicator: () => "px-1",
  indicatorSeparator: () => "bg-slate-200 dark:bg-slate-700",
  menu: () =>
    "mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900",
  menuList: () => "max-h-60 py-1",
  option: ({ isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) =>
    [
      "cursor-pointer px-3 py-2 text-sm",
      isSelected
        ? "bg-teal-600 text-white"
        : isFocused
          ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
          : "text-slate-700 dark:text-slate-300",
    ].join(" "),
};

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-60"
    >
      {pending ? "..." : "ເພີ່ມກຸ່ມ"}
    </button>
  );
}

function AssignRow({
  employeeCode,
  mainOpts,
  subOpts,
}: {
  employeeCode: string;
  mainOpts: GroupOption[];
  subOpts: GroupOption[];
}) {
  const [state, action] = useActionState(assignGroupResponsibility, initial);
  const [main, setMain] = useState<string>("");
  const mainSelect: Opt[] = mainOpts.map((o) => ({ value: o.code, label: o.name || o.code }));
  const subSelect: Opt[] = subOpts
    .filter((o) => !main || o.mainGroup === main)
    .map((o) => ({ value: o.code, label: o.name || o.code }));

  return (
    <form action={action} className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <input type="hidden" name="employee_code" value={employeeCode} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Select<Opt>
            name="group_main"
            instanceId={`main-${employeeCode}`}
            options={mainSelect}
            onChange={(o) => setMain(o?.value ?? "")}
            placeholder="ກຸ່ມຫຼັກ"
            isClearable
            noOptionsMessage={() => "ບໍ່ພົບ"}
            menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            unstyled
            classNames={selectClassNames}
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 50 }) }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Select<Opt>
            name="group_sub"
            instanceId={`sub-${employeeCode}`}
            options={subSelect}
            isClearable
            placeholder="ກຸ່ມຍ່ອຍ (ບໍ່ບັງຄັບ)"
            noOptionsMessage={() => (main ? "ບໍ່ພົບ" : "ເລືອກກຸ່ມຫຼັກກ່ອນ")}
            menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            unstyled
            classNames={selectClassNames}
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 50 }) }}
          />
        </div>
        <AddButton />
      </div>
      {state.error && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">{state.success}</p>}
    </form>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="ລຶບ"
      className="rounded-md px-1.5 text-slate-400 transition hover:text-red-600 disabled:opacity-50"
    >
      ✕
    </button>
  );
}

function GroupChip({ g }: { g: GroupAssignment }) {
  const [, action] = useActionState(removeGroupResponsibility, initial);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
      {g.group_main_name}
      {g.group_sub_name ? ` › ${g.group_sub_name}` : ""}
      <form action={action} className="inline">
        <input type="hidden" name="id" value={g.id} />
        <RemoveButton />
      </form>
    </span>
  );
}

export default function StaffGroupManager({
  staff,
  groupOptions,
}: {
  staff: StaffWithGroups[];
  groupOptions: { main: GroupOption[]; sub: GroupOption[] };
}) {
  return (
    <div className="space-y-4">
      {staff.map((s) => (
        <div key={s.employee_code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                {s.fullname} <span className="font-mono text-xs font-normal text-slate-400">{s.employee_code}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.dept_name}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {s.groups.length} ກຸ່ມ
            </span>
          </div>

          {s.groups.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {s.groups.map((g) => (
                <GroupChip key={g.id} g={g} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">ຍັງບໍ່ໄດ້ກຳນົດກຸ່ມ</p>
          )}

          <AssignRow employeeCode={s.employee_code} mainOpts={groupOptions.main} subOpts={groupOptions.sub} />
        </div>
      ))}
    </div>
  );
}
