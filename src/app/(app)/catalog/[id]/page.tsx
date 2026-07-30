import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CATALOG_ACCENTS, CATALOG_CHANNELS, CATALOG_CURRENCIES, CATALOG_TEMPLATES, getCatalog } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";
import { deleteCatalog, refreshCatalogPrices, updateCatalogMeta, type CatLine } from "../actions";
import CatalogEditor from "./CatalogEditor";

const inputCls =
  "min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const labelCls = "block text-[10px] font-bold uppercase tracking-wide text-slate-400";

export default async function CatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = Number((await params).id);
  if (!id) notFound();
  const data = await getCatalog(id);
  if (!data) notFound();
  const { catalog, items } = data;

  const lines: CatLine[] = items.map((it) => ({
    item_code: it.item_code,
    name: it.name,
    unit: it.unit,
    price: Number(it.price) || 0,
    spec: it.spec,
  }));

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>ໜ້າຫຼັກ</span><span>/</span>
        <Link href="/catalog" className="hover:text-teal-600">ແຄັດຕາລ໊ອກ</Link><span>/</span>
        <span className="text-slate-600">{catalog.title}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{catalog.title}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{CATALOG_CURRENCIES[catalog.currency_code]?.label} · {items.length} ສິນຄ້າ · ສ້າງໂດຍ {catalog.created_by}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/catalog-print/${catalog.id}`} target="_blank" className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-500">🖨 ເບິ່ງ/ພິມ PDF</a>
          <form action={deleteCatalog}><input type="hidden" name="id" value={catalog.id} /><button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:text-slate-300">ລຶບ</button></form>
        </div>
      </div>

      <form action={updateCatalogMeta} className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input type="hidden" name="id" value={catalog.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2"><label className={labelCls}>ຊື່ / ຫົວຂໍ້</label><input name="title" defaultValue={catalog.title} className={inputCls} /></div>
          <div className="lg:col-span-2"><label className={labelCls}>ຄຳບັນຍາຍ (subtitle)</label><input name="subtitle" defaultValue={catalog.subtitle} placeholder="ເຊັ່ນ ໂປຣໂມຊັນ ເດືອນກໍລະກົດ 2026" className={inputCls} /></div>
          <div><label className={labelCls}>ຊ່ອງທາງຂາຍ (ລາຄາ)</label>
            <select name="price_channel" defaultValue={catalog.price_channel} className={inputCls}>
              {CATALOG_CHANNELS.map((ch) => <option key={ch.code} value={ch.code}>{ch.label}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>ສະກຸນເງິນ</label>
            <select name="currency_code" defaultValue={catalog.currency_code} className={inputCls}>
              {Object.entries(CATALOG_CURRENCIES).map(([c, v]) => <option key={c} value={c}>{v.label}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>ຮູບແບບການພິມ (template)</label>
            <select name="template" defaultValue={catalog.template} className={inputCls}>
              {CATALOG_TEMPLATES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">{CATALOG_TEMPLATES.find((t) => t.code === catalog.template)?.hint}</p>
          </div>
          <div><label className={labelCls}>ສີຫຼັກ (accent)</label>
            <select name="accent" defaultValue={catalog.accent} className={inputCls}>
              {CATALOG_ACCENTS.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>ຄໍລຳຕໍ່ແຖວ (Grid/Showcase)</label>
            <select name="columns" defaultValue={catalog.columns} className={inputCls}>
              <option value={2}>2 ຄໍລຳ (ໃຫຍ່)</option>
              <option value={3}>3 ຄໍລຳ</option>
              <option value={4}>4 ຄໍລຳ (ນ້ອຍ)</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="show_price" defaultChecked={catalog.show_price} className="h-4 w-4 accent-teal-600" /> ສະແດງລາຄາ
            </label>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATALOG_TEMPLATES.map((t) => (
            <span key={t.code} className={`rounded-full px-2 py-0.5 text-[10px] ${catalog.template === t.code ? "bg-teal-100 font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{t.label}</span>
          ))}
        </div>
        <div className="mt-3 flex justify-end"><button type="submit" className="rounded-lg bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700">ບັນທຶກຫົວຂໍ້</button></div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-2.5 dark:border-teal-800/50 dark:bg-teal-900/15">
        <span className="text-[11px] text-slate-600 dark:text-slate-300">ຊ່ອງທາງປັດຈຸບັນ: <b className="text-teal-700 dark:text-teal-300">{CATALOG_CHANNELS.find((c) => c.code === catalog.price_channel)?.label}</b></span>
        <form action={refreshCatalogPrices}>
          <input type="hidden" name="id" value={catalog.id} />
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-500">⟳ ດຶງລາຄາໃໝ່ຕາມຊ່ອງທາງ</button>
        </form>
        <span className="text-[10px] text-slate-400">(ອັບເດດລາຄາທຸກສິນຄ້າໃນແຄັດຕາລ໊ອກ ຕາມຊ່ອງທາງທີ່ບັນທຶກໄວ້ — ບັນທຶກຫົວຂໍ້ກ່ອນ ຖ້າຫາກປ່ຽນຊ່ອງທາງ)</span>
      </div>

      <CatalogEditor catalogId={catalog.id} currency={catalog.currency_code} channel={catalog.price_channel} initialLines={lines} />
      <p className="mt-2 text-[11px] text-slate-400">ຮູບສິນຄ້າຈະສະແດງອັດຕະໂນມັດຖ້າມີໃນລະບົບ (ຕັ້ງຄ່າ NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL) — ຖ້າຍັງບໍ່ມີ ຈະສະແດງກ່ອງຊື່ສິນຄ້າແທນ</p>
    </div>
  );
}
