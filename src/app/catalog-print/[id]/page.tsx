import { notFound, redirect } from "next/navigation";
import { CATALOG_ACCENTS, CATALOG_CURRENCIES, getCatalog, type CatalogItem } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/session";
import PrintButton from "./PrintButton";

const IMAGE_BASE = process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL ?? "";

function imageSrc(it: { url_image: string; image_base64: string }): string | null {
  if (it.image_base64) return `data:image/jpeg;base64,${it.image_base64}`;
  if (it.url_image && IMAGE_BASE) return `${IMAGE_BASE.replace(/\/$/, "")}/${it.url_image}`;
  return null;
}
function money(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function CatalogPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = Number((await params).id);
  if (!id) notFound();
  const data = await getCatalog(id);
  if (!data) notFound();
  const { catalog, items } = data;
  const cur = CATALOG_CURRENCIES[catalog.currency_code] ?? { label: "", symbol: "" };
  const accent = CATALOG_ACCENTS.find((a) => a.code === catalog.accent)?.hex ?? "#0d9488";
  const cols = Math.max(2, Math.min(4, catalog.columns));
  const tpl = catalog.template;

  const Thumb = ({ it, cls }: { it: CatalogItem; cls: string }) => {
    const src = imageSrc(it);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={cls} src={src} alt={it.name} />
    ) : (
      <div className={`${cls} ph`}><span>ODIEN</span></div>
    );
  };
  const Price = ({ it }: { it: CatalogItem }) =>
    catalog.show_price && Number(it.price) > 0 ? <span className="price">{cur.symbol} {money(Number(it.price))}</span> : null;

  return (
    <div className={`sheet tpl-${tpl}`}>
      <PrintButton />

      <header className="chead">
        <div className="brand">
          <div className="logo">OD</div>
          <div>
            <div className="cname">ODIEN GROUP</div>
            <div className="ctag">ຜູ້ນຳເຂົ້າ ແລະ ຈຳໜ່າຍເຄື່ອງໃຊ້ໄຟຟ້າ · ອຸປະກອນ</div>
          </div>
        </div>
        <div className="htitle">
          <div className="t1">{catalog.title}</div>
          {catalog.subtitle && <div className="t2">{catalog.subtitle}</div>}
        </div>
      </header>

      {items.length === 0 ? (
        <p className="empty">ຍັງບໍ່ມີສິນຄ້າໃນແຄັດຕາລ໊ອກ</p>
      ) : tpl === "list" ? (
        <div className="listwrap">
          {items.map((it) => (
            <div className="lrow" key={it.id}>
              <Thumb it={it} cls="lthumb" />
              <div className="lbody">
                <div className="lname">{it.name}</div>
                {it.spec && <div className="lspec">{it.spec}</div>}
                {it.item_code && <div className="lcode">{it.item_code}</div>}
              </div>
              <div className="lprice"><Price it={it} /><div className="lunit">{it.unit}</div></div>
            </div>
          ))}
        </div>
      ) : tpl === "pricelist" ? (
        <table className="pl">
          <thead>
            <tr><th className="p-img"></th><th>ລາຍການ</th><th className="p-code">ລະຫັດ</th><th className="p-unit">ໜ່ວຍ</th>{catalog.show_price && <th className="p-price">ລາຄາ</th>}</tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="p-img"><Thumb it={it} cls="pthumb" /></td>
                <td><div className="pname">{it.name}</div>{it.spec && <div className="pspec">{it.spec}</div>}</td>
                <td className="p-code">{it.item_code}</td>
                <td className="p-unit">{it.unit}</td>
                {catalog.show_price && <td className="p-price">{Number(it.price) > 0 ? `${cur.symbol} ${money(Number(it.price))}` : "-"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // grid + showcase both use a card grid, showcase forces big 2-col
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tpl === "showcase" ? Math.min(2, cols) : cols}, 1fr)` }}>
          {items.map((it) => (
            <div className="card" key={it.id}>
              <div className="imgbox"><Thumb it={it} cls="cimg" /></div>
              <div className="cbody">
                <div className="cname2">{it.name}</div>
                {it.spec && <div className="cspec">{it.spec}</div>}
                <div className="cfoot">
                  {it.item_code && <span className="ccode">{it.item_code}</span>}
                  <Price it={it} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="cfooter">ODIEN GROUP · {catalog.title} · ລາຄາເປັນ {cur.label} ອາດປ່ຽນແປງໄດ້ · ຕິດຕໍ່ພະນັກງານຂາຍສຳລັບລາຍລະອຽດ</footer>

      <style>{`
        :root { color-scheme: light; --accent: ${accent}; }
        body { background: #eef1f6; }
        .sheet { font-family: var(--font-noto-lao), system-ui, sans-serif; color: #1e293b; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm 12mm; background: #fff; box-sizing: border-box; box-shadow: 0 8px 40px rgba(15,23,42,.12); }
        .chead { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--accent); padding-bottom: 12px; }
        .brand { display: flex; gap: 12px; align-items: center; }
        .logo { width: 48px; height: 48px; border-radius: 12px; background: var(--accent); color: #fff; font-weight: 800; font-size: 18px; display: grid; place-items: center; }
        .cname { font-size: 20px; font-weight: 800; color: #0f172a; }
        .ctag { font-size: 10px; color: #64748b; }
        .htitle { text-align: right; }
        .t1 { font-size: 18px; font-weight: 800; color: var(--accent); }
        .t2 { font-size: 11px; color: #64748b; margin-top: 2px; }
        .empty { text-align: center; color: #94a3b8; padding: 60px; }
        .price { background: var(--accent); color: #fff; font-weight: 800; font-size: 12px; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .ph { display: grid !important; place-items: center; background: repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 10px,#e9eef5 10px,#e9eef5 20px); }
        .ph span { font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #cbd5e1; }
        .cfooter { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; font-size: 9px; color: #94a3b8; }

        /* GRID + SHOWCASE cards */
        .grid { display: grid; gap: 10px; margin-top: 14px; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; }
        .imgbox { aspect-ratio: 4 / 3; background: #f1f5f9; display: grid; place-items: center; overflow: hidden; }
        .cimg { width: 100%; height: 100%; object-fit: contain; }
        .cbody { padding: 9px 10px; display: flex; flex-direction: column; flex: 1; }
        .cname2 { font-size: 11.5px; font-weight: 700; color: #0f172a; line-height: 1.3; }
        .cspec { font-size: 10px; color: #64748b; margin-top: 3px; flex: 1; }
        .cfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; gap: 6px; }
        .cfoot .price { margin-left: auto; }
        .ccode { font-family: var(--font-geist-mono), monospace; font-size: 8.5px; color: #94a3b8; }
        .tpl-showcase .imgbox { aspect-ratio: 16 / 10; }
        .tpl-showcase .cname2 { font-size: 15px; }
        .tpl-showcase .cspec { font-size: 12px; margin-top: 5px; }
        .tpl-showcase .price { font-size: 15px; padding: 5px 14px; }
        .tpl-showcase .grid { gap: 14px; }

        /* LIST rows */
        .listwrap { margin-top: 14px; }
        .lrow { display: flex; gap: 12px; align-items: center; padding: 10px 4px; border-bottom: 1px solid #eef2f7; page-break-inside: avoid; break-inside: avoid; }
        .lthumb { width: 90px; height: 68px; border-radius: 8px; object-fit: contain; background: #f1f5f9; flex-shrink: 0; }
        .lbody { flex: 1; min-width: 0; }
        .lname { font-size: 13px; font-weight: 700; color: #0f172a; }
        .lspec { font-size: 11px; color: #64748b; margin-top: 2px; }
        .lcode { font-family: var(--font-geist-mono), monospace; font-size: 9px; color: #94a3b8; margin-top: 2px; }
        .lprice { text-align: right; flex-shrink: 0; }
        .lunit { font-size: 9px; color: #94a3b8; margin-top: 4px; }

        /* PRICELIST table */
        .pl { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
        .pl thead th { background: var(--accent); color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; font-weight: 600; }
        .pl thead th:first-child { border-radius: 6px 0 0 0; }
        .pl thead th:last-child { border-radius: 0 6px 0 0; }
        .pl tbody td { padding: 5px 8px; border-bottom: 1px solid #eef2f7; vertical-align: middle; }
        .pl tbody tr:nth-child(even) { background: #f8fafc; }
        .pl tbody tr { page-break-inside: avoid; break-inside: avoid; }
        .p-img { width: 42px; }
        .pthumb { width: 36px; height: 36px; border-radius: 6px; object-fit: contain; background: #f1f5f9; }
        .pthumb.ph span { font-size: 6px; }
        .pname { font-weight: 600; color: #0f172a; }
        .pspec { font-size: 9px; color: #94a3b8; }
        .p-code { font-family: var(--font-geist-mono), monospace; font-size: 9px; color: #64748b; white-space: nowrap; }
        .p-unit { color: #64748b; white-space: nowrap; }
        .p-price { text-align: right; font-weight: 800; color: var(--accent); white-space: nowrap; }

        @media print {
          body { background: #fff; }
          .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 10mm; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
          .card, .price, .pl thead th, .logo, .chead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
