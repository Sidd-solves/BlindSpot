import { AnimatePresence, motion } from 'framer-motion';
import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from 'lucide-react';
import { useStore } from '../store';
import { Loading } from './ui';
import { isPhoto, readPhoto, tableToCsv, type PhotoTable } from '../lib/fileText';

export const ACCEPT =
  '.csv,.tsv,.txt,.tab,.xlsx,.xlsm,.xls,.ods,.numbers,.pdf,.png,.jpg,.jpeg,.webp,text/csv,application/pdf,image/png,image/jpeg,image/webp';
const size = (b: number) =>
  b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;

/**
 * Drop or pick files; each waits in a list (with × to remove) and more can be added. Nothing is read until
 * Next. "add" mode merges the files into what's already loaded (to fill in missing details).
 */
export function UploadZone({
  c = 'var(--blue)',
  title,
  hint,
  icon,
  compact,
  onDone,
  mode = 'replace',
}: {
  c?: string;
  title: string;
  hint: string;
  icon?: ReactNode;
  compact?: boolean;
  onDone?: () => void;
  mode?: 'replace' | 'add';
}) {
  const { upload, stageFiles, unstage, readStaged } = useStore();
  const [drag, setDrag] = useState(false),
    [err, setErr] = useState(''),
    [mine, setMine] = useState(false),
    [photo, setPhoto] = useState<PhotoTable | null>(null),
    [reading, setReading] = useState(false);
  const staged = upload.staged;
  // A photo is read by AI first and shown for review; only the table the owner approves is staged.
  const readOne = async (f: File) => {
    setReading(true);
    setErr('');
    try {
      setPhoto(await readPhoto(f));
    } catch (e: any) {
      setErr(e?.message ?? 'Reading the photo failed. Try a clearer photo.');
    }
    setReading(false);
  };
  const add = (list?: FileList | null) => {
    const all = [...(list ?? [])];
    const pics = all.filter(isPhoto);
    if (pics.length) void readOne(pics[0]);
    if (pics.length > 1) setErr('Photos are reviewed one at a time: the first one is open now.');
    const files = all.filter((f) => !isPhoto(f));
    if (!files.length) return;
    setErr('');
    const big = files.find((f) => f.size > 25e6);
    if (big)
      return setErr(
        `${big.name} is over 25 MB. Export a shorter date range, or split it into two files and add both.`,
      );
    if (staged.length + files.length > 5) setErr('Up to 5 files at a time; the first ones were kept.');
    stageFiles(files);
  };
  const next = async () => {
    setMine(true);
    const r = await readStaged(mode);
    if (r !== 'failed') onDone?.();
  };
  const busy = mine && !!upload.busy;
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {(reading || photo) && (
          <PhotoReview
            photo={photo}
            reading={reading}
            onCancel={() => setPhoto(null)}
            onUse={(t) => {
              stageFiles([new File([tableToCsv(t.columns, t.table)], t.name, { type: 'text/csv' })]);
              setPhoto(null);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {staged.map((f, i) => {
          const pdf = /\.pdf$/i.test(f.name),
            Icon = pdf ? FileText : FileSpreadsheet,
            ic = pdf ? 'var(--sky)' : 'var(--emerald)';
          return (
            <motion.div
              key={`${f.name}${f.size}${f.lastModified}`}
              layout
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, height: 0, marginTop: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2"
              style={{
                borderColor: `color-mix(in srgb, ${ic} 30%, var(--line))`,
                background: `color-mix(in srgb, ${ic} 6%, transparent)`,
              }}
            >
              <span
                className="grid h-8 w-8 flex-none place-items-center rounded-lg"
                style={{ background: `color-mix(in srgb, ${ic} 16%, transparent)`, color: ic }}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold" title={f.name}>
                  {f.name}
                </div>
                <div className="text-[11.5px] text-[var(--faint)]">{size(f.size)} · ready to read</div>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => unstage(i)}
                disabled={busy}
                className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--rose)]"
                aria-label={`Remove ${f.name}`}
              >
                <X size={14} />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={`grid cursor-pointer place-items-center rounded-xl border-2 border-dashed px-3 text-center transition-colors ${staged.length ? 'py-2.5' : compact ? 'py-3' : 'py-5'} ${busy ? 'scan' : ''}`}
        style={
          {
            borderColor: drag ? c : 'var(--line-strong)',
            background: drag ? `color-mix(in srgb, ${c} 8%, transparent)` : 'transparent',
          } as CSSProperties
        }
      >
        <input
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
        {staged.length ? (
          <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: c }}>
            <Plus size={14} />
            Add another file<span className="font-normal text-[var(--faint)]">· drop or click</span>
          </div>
        ) : (
          <>
            <motion.div
              animate={{ y: drag ? -5 : [0, -3, 0] }}
              transition={{ duration: 2, repeat: drag ? 0 : Infinity }}
              style={{ color: c }}
            >
              {icon ?? <UploadCloud size={22} />}
            </motion.div>
            <div className="mt-1 text-[12.5px] font-bold">{title}</div>
            <div className="text-[11.5px] text-[var(--faint)]">{hint} · drop or click to choose</div>
          </>
        )}
      </label>

      <AnimatePresence>
        {staged.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="flex items-center justify-between gap-2"
          >
            <span className="text-[11px] text-[var(--faint)]">
              {staged.length} file{staged.length > 1 ? 's' : ''} · read together when you press Next
            </span>
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={next}
              disabled={busy}
              className="btn btn-primary"
            >
              {busy ? (
                <Loading steps={[upload.busy ?? 'Reading…', 'Finding the columns…', 'Checking every row…']} />
              ) : (
                <>
                  {mode === 'add' ? 'Add & re-read' : 'Next'}
                  <ArrowRight size={13} />
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      {(err || (mine && upload.error && !upload.open)) && (
        <div className="text-[11.5px] text-[var(--rose)]">{err || upload.error}</div>
      )}
    </div>
  );
}

/** The table AI read from a photo, editable cell by cell, shown before anything is analysed. */
function PhotoReview({
  photo,
  reading,
  onCancel,
  onUse,
}: {
  photo: PhotoTable | null;
  reading: boolean;
  onCancel: () => void;
  onUse: (t: PhotoTable) => void;
}) {
  const [rows, setRows] = useState<(string | number | null)[][] | null>(null);
  const table = rows ?? photo?.table ?? [];
  const blank = table.reduce((n, r) => n + r.filter((v) => v === null || v === '').length, 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-xl border p-3"
      style={{ borderColor: 'color-mix(in srgb, var(--fuchsia) 45%, var(--line))' }}
    >
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-extrabold">
        <Camera size={14} style={{ color: 'var(--fuchsia)' }} />
        {reading ? 'Reading the photo with AI…' : 'Check the table AI read from your photo'}
      </div>
      {reading || !photo ? (
        <div className="flex items-center gap-2 py-4 text-[12px] text-[var(--muted)]">
          <Loader2 size={14} className="animate-spin" /> Copying each printed cell into a table. Nothing is
          analysed until you approve it.
        </div>
      ) : (
        <>
          <div className="mb-2 text-[11.5px] text-[var(--muted)]">
            {table.length} rows · {photo.columns.length} columns{photo.title ? ` · “${photo.title}”` : ''}.
            Click any cell to fix it.{' '}
            {blank ? `${blank} cell(s) couldn’t be read (highlighted).` : 'Every cell was read.'}
            {photo.unreadable.length > 0 && ` AI notes: ${photo.unreadable.slice(0, 3).join('; ')}`}
          </div>
          <div
            className="max-h-[260px] overflow-auto rounded-lg border"
            style={{ borderColor: 'var(--line)' }}
          >
            <table className="w-full border-collapse text-[11.5px]">
              <thead className="sticky top-0" style={{ background: 'var(--panel-solid)' }}>
                <tr>
                  {photo.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-2 py-1 text-left font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--line)' }}>
                    {r.map((v, j) => (
                      <td
                        key={j}
                        className="p-0"
                        style={{
                          background:
                            v === null || v === ''
                              ? 'color-mix(in srgb, var(--amber) 18%, transparent)'
                              : undefined,
                        }}
                      >
                        <input
                          value={v ?? ''}
                          onChange={(e) => {
                            const next = table.map((x) => x.slice());
                            next[i][j] = e.target.value;
                            setRows(next);
                          }}
                          className="w-full min-w-[70px] bg-transparent px-2 py-1 outline-none focus:bg-[var(--line)]"
                          aria-label={`${photo.columns[j]}, row ${i + 1}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex gap-1.5">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn btn-primary !h-8 text-[12px]"
              onClick={() => onUse({ ...photo, table })}
            >
              <Check size={13} /> Use this table
            </motion.button>
            <button className="btn !h-8 text-[12px]" onClick={onCancel}>
              <X size={13} /> Discard
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
