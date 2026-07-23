"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { uploadAttachmentAction, type UploadState } from "../actions";

function UploadBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-500 disabled:opacity-60">
      {pending ? "ກຳລັງອັບໂຫຼດ..." : "ອັບໂຫຼດ"}
    </button>
  );
}

export default function AttachmentUpload({ docNo }: { docNo: string }) {
  const [state, action] = useActionState<UploadState, FormData>(uploadAttachmentAction, { error: null, ok: false });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="doc_no" value={docNo} />
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-slate-400">ປະເພດ</label>
        <select name="kind" className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <option value="plan">ແຜນ</option>
          <option value="document">ເອກະສານ</option>
        </select>
      </div>
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-slate-400">ໄຟລ໌ (ຫຼາຍໄຟລ໌ໄດ້, ≤20MB)</label>
        <input name="files" type="file" multiple className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200" />
      </div>
      <UploadBtn />
      {state.error && <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
