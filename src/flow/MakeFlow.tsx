/**
 * The whole Christmas flow, on one screen at a time, built for a phone:
 *
 *   photo -> blur check -> pick a look (As drawn / Screen print)
 *         -> pick a gift (framed print / mug, shown with that look)
 *         -> order
 *
 * No accounts, no styles, no editing. Both looks are made on the device in
 * about a second (src/pipeline), so the parent sees their child's drawing on
 * the product before they have decided anything.
 *
 * Ordering is handed to `onOrder`. Payment is not built yet; until it is,
 * App passes a handler that says so rather than one that orders anything.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, Upload } from 'lucide-react';
import { measureSharpness } from '../utils/sharpness';
import { LookId, makeLooks, toCanvas } from '../pipeline/looks';
import { ProductId, productMockup } from './mockups';
import { PRODUCTS, formatAud } from './products';

export interface OrderSelection {
  /** The original photo, kept so the print file is made from it at full size. */
  photo: string;
  look: LookId;
  product: ProductId;
}

interface MakeFlowProps {
  initialFile?: File;
  onOrder: (selection: OrderSelection) => void;
}

type Step = 'pick' | 'working' | 'blurry' | 'choose' | 'failed';

const LOOKS: { id: LookId; name: string; blurb: string }[] = [
  { id: 'as_drawn', name: 'As drawn', blurb: 'Cleaned up, exactly as they drew it' },
  { id: 'screen_print', name: 'Screen print', blurb: 'Their drawing in bold, flat inks' },
];

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const MakeFlow: React.FC<MakeFlowProps> = ({ initialFile, onOrder }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [photo, setPhoto] = useState('');
  const [looks, setLooks] = useState<Record<LookId, HTMLCanvasElement> | null>(null);
  const [lookUrls, setLookUrls] = useState<Record<string, string>>({});
  const [look, setLook] = useState<LookId | null>(null);
  const [product, setProduct] = useState<ProductId | null>(null);
  const [mockups, setMockups] = useState<Record<string, string>>({});
  // A slow run on an earlier photo must not land on top of the current one.
  const run = useRef(0);

  const makeLooksFor = async (src: string, id: number) => {
    const res = await makeLooks(src);
    if (id !== run.current) return;
    const canvases = Object.fromEntries(res.looks.map((l) => [l.id, toCanvas(l.image)])) as Record<LookId, HTMLCanvasElement>;
    setLooks(canvases);
    setLookUrls(Object.fromEntries(Object.entries(canvases).map(([k, c]) => [k, c.toDataURL('image/jpeg', 0.88)])));
    setStep('choose');
  };

  const start = async (file: File) => {
    const id = ++run.current;
    setLooks(null);
    setLookUrls({});
    setLook(null);
    setProduct(null);
    setMockups({});
    setStep('working');
    try {
      const src = await readFile(file);
      if (id !== run.current) return;
      setPhoto(src);
      // The blur check is local and takes a fraction of a second. A check
      // that cannot run must not block the photo.
      const sharp = await measureSharpness(src).catch(() => null);
      if (id !== run.current) return;
      if (sharp?.verdict === 'blurry') {
        setStep('blurry');
        return;
      }
      await makeLooksFor(src, id);
    } catch (e) {
      console.error('Could not prepare the photo:', e);
      if (id === run.current) setStep('failed');
    }
  };

  useEffect(() => {
    if (initialFile) start(initialFile);
    // Only the file the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  // Mockups for the chosen look, both products, as soon as a look is picked.
  useEffect(() => {
    if (!looks || !look) return;
    const art = looks[look];
    const next: Record<string, string> = {};
    // The art's own paper: screen print is made on cream. The mug preview
    // moves its inks onto white itself; the framed print keeps the cream.
    const artPaper = look === 'screen_print' ? 'cream' : 'white';
    for (const p of PRODUCTS) next[p.id] = productMockup(p.id, art, artPaper).toDataURL('image/jpeg', 0.88);
    setMockups(next);
  }, [looks, look]);

  const chooseAgain = () => {
    run.current++;
    setStep('pick');
    setPhoto('');
    inputRef.current?.click();
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      data-testid="flow-file"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) start(f);
      }}
    />
  );

  const selected = PRODUCTS.find((p) => p.id === product);

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-10">
        {fileInput}

        {step === 'pick' && (
          <div className="text-center">
            <h1 className="font-serif text-4xl text-stone-900 mb-3">Their drawing, made into a gift</h1>
            <p className="text-stone-600 mb-8">Take a photo of the drawing. You'll see it as a print and on a mug straight away.</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full min-h-[56px] px-6 py-4 bg-terracotta hover:bg-terracotta/90 text-white text-lg font-medium rounded-lg shadow-md flex items-center justify-center gap-3"
            >
              <Upload size={22} />
              Choose a photo of the drawing
            </button>
            <ul className="mt-8 text-sm text-stone-600 space-y-2 text-left inline-block">
              <li>Lay the drawing flat, in good daylight</li>
              <li>Hold the phone straight above it</li>
              <li>Fill the frame with the paper</li>
            </ul>
          </div>
        )}

        {step === 'working' && (
          <div className="text-center py-16" data-testid="flow-working">
            <Loader2 className="animate-spin mx-auto text-terracotta mb-4" size={36} />
            <p className="font-serif text-2xl text-stone-900">Getting it ready</p>
          </div>
        )}

        {step === 'failed' && (
          <div className="text-center py-12">
            <p className="font-serif text-2xl text-stone-900 mb-2">That photo didn't open</p>
            <p className="text-stone-600 mb-6">Try another photo of the drawing.</p>
            <button onClick={chooseAgain} className="min-h-[48px] px-6 py-3 bg-terracotta text-white rounded-lg font-medium">
              Choose another photo
            </button>
          </div>
        )}

        {step === 'blurry' && (
          <div className="space-y-5" data-testid="flow-blurry">
            <img src={photo} alt="Your photo" className="w-full max-h-80 object-contain rounded-lg border border-stone-200 bg-white" />
            <div role="alert" className="border-2 border-terracotta/30 bg-white rounded-lg p-5 text-stone-700">
              <p className="font-serif text-xl text-stone-900">This photo looks blurry</p>
              <p className="text-sm mt-2">
                Blur shows far more on a print than on a phone screen. Lay the drawing flat in good light, hold the phone
                still directly above it, and take the photo again.
              </p>
            </div>
            <button onClick={chooseAgain} className="w-full min-h-[52px] px-6 py-3 bg-terracotta text-white rounded-lg font-medium flex items-center justify-center gap-2">
              <Upload size={20} /> Retake photo
            </button>
            <button
              onClick={() => {
                const id = ++run.current;
                setStep('working');
                makeLooksFor(photo, id).catch(() => id === run.current && setStep('failed'));
              }}
              className="w-full min-h-[48px] text-stone-600 underline"
            >
              Use it anyway
            </button>
          </div>
        )}

        {step === 'choose' && looks && (
          <div className="space-y-10">
            <section>
              <h2 className="font-serif text-2xl text-stone-900 mb-1">Pick a look</h2>
              <p className="text-sm text-stone-600 mb-4">Same drawing, two ways. Nothing is redrawn.</p>
              <div className="grid grid-cols-2 gap-3">
                {LOOKS.map((l) => (
                  <button
                    key={l.id}
                    data-testid={`look-${l.id}`}
                    onClick={() => setLook(l.id)}
                    aria-pressed={look === l.id}
                    className={`text-left bg-white rounded-lg p-2 border-2 transition ${
                      look === l.id ? 'border-terracotta shadow-md' : 'border-stone-200'
                    }`}
                  >
                    <img src={lookUrls[l.id]} alt={l.name} className="w-full aspect-[3/4] object-contain bg-stone-100 rounded" />
                    <div className="px-1 pt-2 pb-1">
                      <div className="flex items-center gap-1 font-medium text-stone-900">
                        {look === l.id && <Check size={16} className="text-terracotta" />}
                        {l.name}
                      </div>
                      <div className="text-xs text-stone-600">{l.blurb}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {look && (
              <section>
                <h2 className="font-serif text-2xl text-stone-900 mb-4">Pick a gift</h2>
                <div className="grid grid-cols-2 gap-3">
                  {PRODUCTS.map((p) => (
                    <button
                      key={p.id}
                      data-testid={`product-${p.id}`}
                      onClick={() => setProduct(p.id)}
                      aria-pressed={product === p.id}
                      className={`text-left bg-white rounded-lg p-2 border-2 transition ${
                        product === p.id ? 'border-terracotta shadow-md' : 'border-stone-200'
                      }`}
                    >
                      {mockups[p.id] ? (
                        <img src={mockups[p.id]} alt={`${p.name} preview`} className="w-full aspect-square object-cover rounded" />
                      ) : (
                        <div className="w-full aspect-square bg-stone-100 rounded" />
                      )}
                      <div className="px-1 pt-2 pb-1">
                        <div className="flex items-center justify-between font-medium text-stone-900">
                          <span className="flex items-center gap-1">
                            {product === p.id && <Check size={16} className="text-terracotta" />}
                            {p.name}
                          </span>
                          <span>{formatAud(p.priceCents)}</span>
                        </div>
                        <div className="text-xs text-stone-600">{p.detail}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {look && selected && mockups[selected.id] && (
              <img
                src={mockups[selected.id]}
                alt={`Your ${selected.name.toLowerCase()}`}
                data-testid="flow-preview"
                className="w-full rounded-lg border border-stone-200 shadow-sm"
              />
            )}

            {look && selected && (
              <button
                data-testid="flow-order"
                onClick={() => onOrder({ photo, look, product: selected.id })}
                className="w-full min-h-[56px] px-6 py-4 bg-terracotta hover:bg-terracotta/90 text-white text-lg font-medium rounded-lg shadow-md"
              >
                Order {selected.name.toLowerCase()} · {formatAud(selected.priceCents)}
              </button>
            )}

            <button onClick={chooseAgain} className="w-full min-h-[44px] text-stone-600 flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Use a different photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
