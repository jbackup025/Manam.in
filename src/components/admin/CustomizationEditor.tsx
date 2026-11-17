import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Plus,
  QrCode,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  HEADING_FONTS,
  MAX_ASSETS_PER_WEDDING,
  THEME_PRESETS,
  type HeadingFontName,
  type ThemePresetId,
} from '../../lib/constants';
import { deleteWeddingAsset, listWeddingAssets, uploadWeddingAsset } from '../../lib/assetStore';
import { evaluateThemeContrast } from '../../lib/contrast';
import { buildUpiLinks, generateUpiQrDataUrl } from '../../lib/upi';
import type {
  AssetKind,
  BeneficiaryConfig,
  PublicSiteDoc,
  WeddingAssetDoc,
} from '../../types/wedding';

interface CustomizationEditorProps {
  slug: string;
  draft: PublicSiteDoc;
  onChange: (next: PublicSiteDoc) => void;
  savingState: 'idle' | 'saving' | 'saved' | 'error';
  onSaveNow: () => void;
}

export function CustomizationEditor({
  slug,
  draft,
  onChange,
  savingState,
  onSaveNow,
}: CustomizationEditorProps) {
  const [subTab, setSubTab] = useState<
    'couple' | 'theme' | 'sections' | 'rsvp' | 'wishlist' | 'labels'
  >('couple');
  const [assets, setAssets] = useState<WeddingAssetDoc[]>([]);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [testUpiModal, setTestUpiModal] = useState<{
    label: string;
    upiId: string;
    payeeName: string;
    qrUrl: string;
    upiUri: string;
  } | null>(null);

  useEffect(() => {
    listWeddingAssets(slug)
      .then(setAssets)
      .catch(() => {});
  }, [slug]);

  const contrast = evaluateThemeContrast({
    backgroundColor: draft.theme.backgroundColor,
    primaryColor: draft.theme.primaryColor,
    accentColor: draft.theme.accentColor,
  });

  async function handleUpload(
    file: File | undefined,
    kind: AssetKind,
    onDone: (assetId: string) => void
  ) {
    if (!file) return;
    setUploadError('');
    setUploadingKind(kind);
    try {
      const saved = await uploadWeddingAsset(slug, file, kind);
      setAssets((prev) => [saved, ...prev]);
      if (saved.id) onDone(saved.id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleRemoveAsset(assetId: string) {
    if (!assetId) return;
    try {
      await deleteWeddingAsset(slug, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch {
      // ignore if already removed
    }
  }

  async function openTestUpi(b: BeneficiaryConfig) {
    if (!b.upiId.trim()) return;
    const links = buildUpiLinks({
      upiId: b.upiId,
      payeeName: b.payeeName || b.displayName,
      amountRupees: 1,
      ref: 'TEST01',
    });
    const qrUrl = await generateUpiQrDataUrl(links.upiUri);
    setTestUpiModal({
      label: b.displayName,
      upiId: b.upiId,
      payeeName: b.payeeName || b.displayName,
      qrUrl,
      upiUri: links.upiUri,
    });
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= draft.sections.length) return;
    const next = [...draft.sections];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    onChange({ ...draft, sections: next });
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation + Save Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1D1915]/10 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'couple' as const, label: 'Couple & SEO' },
            { id: 'theme' as const, label: 'Theme & Contrast' },
            { id: 'sections' as const, label: 'Sections & Content' },
            { id: 'rsvp' as const, label: 'RSVP Builder' },
            { id: 'wishlist' as const, label: 'Wishlist & UPI' },
            { id: 'labels' as const, label: 'Labels & Images' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                subTab === t.id
                  ? 'bg-[#1D1915] text-[#FAF7F2]'
                  : 'bg-white border border-[#1D1915]/12 text-[#5E554B] hover:text-[#1D1915]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#5E554B]">
            {savingState === 'saving'
              ? 'Autosaving...'
              : savingState === 'saved'
                ? 'All changes saved'
                : savingState === 'error'
                  ? 'Save failed'
                  : 'Draft ready'}
          </span>
          <button
            type="button"
            onClick={onSaveNow}
            className="min-h-[40px] px-4 py-1.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-xs font-medium cursor-pointer"
          >
            Save now
          </button>
        </div>
      </div>

      {uploadError && (
        <div role="alert" className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs">
          {uploadError}
        </div>
      )}

      {/* TAB: COUPLE & SEO */}
      {subTab === 'couple' && (
        <div className="grid sm:grid-cols-2 gap-4 bg-white border border-[#1D1915]/10 rounded-xl p-6">
          <div>
            <label className="block text-xs font-medium mb-1">Partner 1 Name</label>
            <input
              type="text"
              value={draft.couple.partner1Name}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, partner1Name: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Partner 1 Role Label</label>
            <input
              type="text"
              value={draft.couple.partner1Role}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, partner1Role: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Partner 2 Name</label>
            <input
              type="text"
              value={draft.couple.partner2Name}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, partner2Name: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Partner 2 Role Label</label>
            <input
              type="text"
              value={draft.couple.partner2Role}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, partner2Role: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Wedding Date (Display)</label>
            <input
              type="date"
              value={draft.couple.weddingDate}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, weddingDate: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Wedding Time</label>
            <input
              type="text"
              value={draft.couple.weddingTime}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, weddingTime: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Opening Blessing / Verse Line</label>
            <input
              type="text"
              value={draft.couple.openingVerse}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, openingVerse: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Hero Tagline</label>
            <textarea
              rows={2}
              value={draft.couple.heroTagline}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, heroTagline: e.target.value } })
              }
              className="w-full p-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Guest Contact Name (optional)</label>
            <input
              type="text"
              value={draft.couple.contactName}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, contactName: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Guest Contact Phone (optional)</label>
            <input
              type="text"
              value={draft.couple.contactPhone}
              onChange={(e) =>
                onChange({ ...draft, couple: { ...draft.couple, contactPhone: e.target.value } })
              }
              className="w-full min-h-[42px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>

          {/* Uploads: Logo & Hero */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              Monogram / Logo (max 400px, 100 KB)
            </label>
            <label className="min-h-[42px] px-3 rounded-lg border border-dashed border-[#1D1915]/25 inline-flex items-center gap-2 text-xs cursor-pointer hover:bg-[#FAF7F2]">
              <Upload className="w-4 h-4" />
              {uploadingKind === 'logo' ? 'Compressing...' : 'Upload Logo WebP'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleUpload(e.target.files?.[0], 'logo', (id) =>
                    onChange({ ...draft, couple: { ...draft.couple, logoAssetId: id } })
                  )
                }
              />
            </label>
            {draft.couple.logoAssetId && (
              <button
                type="button"
                onClick={() =>
                  onChange({ ...draft, couple: { ...draft.couple, logoAssetId: '' } })
                }
                className="ml-3 text-xs text-[#991B1B] underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Hero Image (max 1600px, 250 KB)
            </label>
            <label className="min-h-[42px] px-3 rounded-lg border border-dashed border-[#1D1915]/25 inline-flex items-center gap-2 text-xs cursor-pointer hover:bg-[#FAF7F2]">
              <Upload className="w-4 h-4" />
              {uploadingKind === 'hero' ? 'Compressing...' : 'Upload Hero WebP'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleUpload(e.target.files?.[0], 'hero', (id) =>
                    onChange({ ...draft, couple: { ...draft.couple, heroAssetId: id } })
                  )
                }
              />
            </label>
            {draft.couple.heroAssetId && (
              <button
                type="button"
                onClick={() =>
                  onChange({ ...draft, couple: { ...draft.couple, heroAssetId: '' } })
                }
                className="ml-3 text-xs text-[#991B1B] underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="sm:col-span-2 pt-3 border-t border-[#1D1915]/10 space-y-3">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.countdownEnabled}
                onChange={(e) => onChange({ ...draft, countdownEnabled: e.target.checked })}
              />
              <span>Show live wedding countdown timer</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.seo.hideFromSearchEngines}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    seo: { ...draft.seo, hideFromSearchEngines: e.target.checked },
                  })
                }
              />
              <span>Hide from search engines (recommended, adds noindex)</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Share Preview Page Title</label>
                <input
                  type="text"
                  value={draft.seo.customTitle}
                  onChange={(e) =>
                    onChange({ ...draft, seo: { ...draft.seo, customTitle: e.target.value } })
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Share Preview Description</label>
                <input
                  type="text"
                  value={draft.seo.customDescription}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      seo: { ...draft.seo, customDescription: e.target.value },
                    })
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: THEME & CONTRAST */}
      {subTab === 'theme' && (
        <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-6">
          <div>
            <p className="text-sm font-medium mb-3">Ready-made Theme Presets</p>
            <div className="grid sm:grid-cols-5 gap-3">
              {THEME_PRESETS.map((preset) => {
                const active = draft.theme.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        theme: {
                          preset: preset.id as ThemePresetId,
                          primaryColor: preset.primaryColor,
                          accentColor: preset.accentColor,
                          backgroundColor: preset.backgroundColor,
                          headingFont: preset.headingFont,
                        },
                      })
                    }
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      active ? 'border-[#1D1915] ring-2 ring-[#1D1915]/20' : 'border-[#1D1915]/15'
                    }`}
                  >
                    <div className="flex gap-1.5 mb-2">
                      <span
                        className="w-5 h-5 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.backgroundColor }}
                      />
                      <span
                        className="w-5 h-5 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.primaryColor }}
                      />
                      <span
                        className="w-5 h-5 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                    </div>
                    <p className="text-xs font-semibold">{preset.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Primary Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={draft.theme.primaryColor}
                  onChange={(e) =>
                    onChange({ ...draft, theme: { ...draft.theme, primaryColor: e.target.value } })
                  }
                  className="w-10 h-10 rounded border border-[#1D1915]/15 cursor-pointer"
                />
                <input
                  type="text"
                  value={draft.theme.primaryColor}
                  onChange={(e) =>
                    onChange({ ...draft, theme: { ...draft.theme, primaryColor: e.target.value } })
                  }
                  className="w-full min-h-[40px] px-2.5 rounded border border-[#1D1915]/15 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Accent Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={draft.theme.accentColor}
                  onChange={(e) =>
                    onChange({ ...draft, theme: { ...draft.theme, accentColor: e.target.value } })
                  }
                  className="w-10 h-10 rounded border border-[#1D1915]/15 cursor-pointer"
                />
                <input
                  type="text"
                  value={draft.theme.accentColor}
                  onChange={(e) =>
                    onChange({ ...draft, theme: { ...draft.theme, accentColor: e.target.value } })
                  }
                  className="w-full min-h-[40px] px-2.5 rounded border border-[#1D1915]/15 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Background Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={draft.theme.backgroundColor}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      theme: { ...draft.theme, backgroundColor: e.target.value },
                    })
                  }
                  className="w-10 h-10 rounded border border-[#1D1915]/15 cursor-pointer"
                />
                <input
                  type="text"
                  value={draft.theme.backgroundColor}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      theme: { ...draft.theme, backgroundColor: e.target.value },
                    })
                  }
                  className="w-full min-h-[40px] px-2.5 rounded border border-[#1D1915]/15 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Heading Font</label>
              <select
                value={draft.theme.headingFont}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    theme: { ...draft.theme, headingFont: e.target.value as HeadingFontName },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              >
                {HEADING_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Automatic Text Contrast Check */}
          <div className="p-4 rounded-xl border border-[#1D1915]/12 bg-[#FAF7F2] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              {contrast.passesAA ? (
                <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#B45309]" />
              )}
              <span>
                Automatic Contrast Check: Body {contrast.bgToBodyRatio}:1 · Button{' '}
                {contrast.btnRatio}:1 ({contrast.passesAA ? 'WCAG AA Pass' : 'Adjust colors for higher contrast'})
              </span>
            </div>
            <span className="text-xs text-[#5E554B]">
              Text automatically adapts to {contrast.bodyText} on background
            </span>
          </div>
        </div>
      )}

      {/* TAB: SECTIONS & CONTENT */}
      {subTab === 'sections' && (
        <div className="space-y-6">
          {/* Reorder & Toggle Sections */}
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6">
            <h3 className="text-base font-semibold mb-3">Section Visibility &amp; Order</h3>
            <div className="divide-y divide-[#1D1915]/10">
              {draft.sections.map((sec, idx) => (
                <div key={sec.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <input
                      type="checkbox"
                      checked={sec.enabled}
                      onChange={(e) => {
                        const next = [...draft.sections];
                        next[idx] = { ...sec, enabled: e.target.checked };
                        onChange({ ...draft, sections: next });
                      }}
                    />
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const next = [...draft.sections];
                        next[idx] = { ...sec, title: e.target.value };
                        onChange({ ...draft, sections: next });
                      }}
                      className="min-h-[38px] px-2.5 rounded border border-[#1D1915]/15 text-sm flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Move ${sec.title} up`}
                      onClick={() => moveSection(idx, -1)}
                      disabled={idx === 0}
                      className="min-w-[36px] min-h-[36px] rounded border border-[#1D1915]/15 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${sec.title} down`}
                      onClick={() => moveSection(idx, 1)}
                      disabled={idx === draft.sections.length - 1}
                      className="min-w-[36px] min-h-[36px] rounded border border-[#1D1915]/15 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Story Editor */}
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-3">
            <h3 className="text-base font-semibold">Our Story</h3>
            <input
              type="text"
              value={draft.story.heading}
              onChange={(e) =>
                onChange({ ...draft, story: { ...draft.story, heading: e.target.value } })
              }
              placeholder="Story heading"
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
            <textarea
              rows={4}
              value={draft.story.body}
              onChange={(e) =>
                onChange({ ...draft, story: { ...draft.story, body: e.target.value } })
              }
              placeholder="Write your story"
              className="w-full p-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
            <label className="min-h-[40px] px-3 rounded-lg border border-dashed border-[#1D1915]/25 inline-flex items-center gap-2 text-xs cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploadingKind === 'story' ? 'Uploading...' : 'Upload Story Photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleUpload(e.target.files?.[0], 'story', (id) =>
                    onChange({ ...draft, story: { ...draft.story, imageAssetId: id } })
                  )
                }
              />
            </label>
          </div>

          {/* Events Editor */}
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Events ({draft.events.length})</h3>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    events: [
                      ...draft.events,
                      {
                        id: `ev-${Date.now()}`,
                        title: 'Reception',
                        date: draft.couple.weddingDate,
                        time: '07:00 PM',
                        venue: 'Grand Ballroom',
                        address: '',
                        mapLink: '',
                        photoAssetId: '',
                        fallbackUrl: '',
                        description: '',
                      },
                    ],
                  })
                }
                className="min-h-[38px] px-3 rounded-lg bg-[#1D1915] text-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Event
              </button>
            </div>
            {draft.events.map((ev, idx) => (
              <div key={ev.id} className="p-4 rounded-xl border border-[#1D1915]/12 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold">Event {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        events: draft.events.filter((_, i) => i !== idx),
                      })
                    }
                    className="text-xs text-[#991B1B] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <div className="grid sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={ev.title}
                    onChange={(e) => {
                      const next = [...draft.events];
                      next[idx] = { ...ev, title: e.target.value };
                      onChange({ ...draft, events: next });
                    }}
                    placeholder="Event title"
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                  <input
                    type="date"
                    value={ev.date}
                    onChange={(e) => {
                      const next = [...draft.events];
                      next[idx] = { ...ev, date: e.target.value };
                      onChange({ ...draft, events: next });
                    }}
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                  <input
                    type="text"
                    value={ev.time}
                    onChange={(e) => {
                      const next = [...draft.events];
                      next[idx] = { ...ev, time: e.target.value };
                      onChange({ ...draft, events: next });
                    }}
                    placeholder="10:30 AM"
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                  <input
                    type="text"
                    value={ev.venue}
                    onChange={(e) => {
                      const next = [...draft.events];
                      next[idx] = { ...ev, venue: e.target.value };
                      onChange({ ...draft, events: next });
                    }}
                    placeholder="Venue name"
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                  <input
                    type="text"
                    value={ev.address}
                    onChange={(e) => {
                      const next = [...draft.events];
                      next[idx] = { ...ev, address: e.target.value };
                      onChange({ ...draft, events: next });
                    }}
                    placeholder="Full address"
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                  <input
                    type="url"
                    value={ev.mapLink}
                    onChange={(e) => {
                      const next = [...draft.events];
                      next[idx] = { ...ev, mapLink: e.target.value };
                      onChange({ ...draft, events: next });
                    }}
                    placeholder="Google Maps URL"
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={ev.description}
                  onChange={(e) => {
                    const next = [...draft.events];
                    next[idx] = { ...ev, description: e.target.value };
                    onChange({ ...draft, events: next });
                  }}
                  placeholder="Short description / dress code"
                  className="w-full min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                />
                <label className="min-h-[36px] px-3 rounded border border-dashed border-[#1D1915]/25 inline-flex items-center gap-2 text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Event Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e.target.files?.[0], 'event', (id) => {
                        const next = [...draft.events];
                        next[idx] = { ...ev, photoAssetId: id };
                        onChange({ ...draft, events: next });
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>

          {/* Accommodations Editor */}
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Accommodations ({draft.accommodations.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    accommodations: [
                      ...draft.accommodations,
                      {
                        id: `hotel-${Date.now()}`,
                        name: '',
                        address: '',
                        phone: '',
                        mapLink: '',
                        notes: '',
                      },
                    ],
                  })
                }
                className="min-h-[38px] px-3 rounded-lg bg-[#1D1915] text-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Hotel
              </button>
            </div>
            {draft.accommodations.map((acc, idx) => (
              <div key={acc.id} className="p-4 rounded-xl border border-[#1D1915]/12 grid sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={acc.name}
                  onChange={(e) => {
                    const next = [...draft.accommodations];
                    next[idx] = { ...acc, name: e.target.value };
                    onChange({ ...draft, accommodations: next });
                  }}
                  placeholder="Hotel Name"
                  className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                />
                <input
                  type="text"
                  value={acc.phone}
                  onChange={(e) => {
                    const next = [...draft.accommodations];
                    next[idx] = { ...acc, phone: e.target.value };
                    onChange({ ...draft, accommodations: next });
                  }}
                  placeholder="Phone"
                  className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                />
                <input
                  type="text"
                  value={acc.address}
                  onChange={(e) => {
                    const next = [...draft.accommodations];
                    next[idx] = { ...acc, address: e.target.value };
                    onChange({ ...draft, accommodations: next });
                  }}
                  placeholder="Address"
                  className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                />
                <input
                  type="url"
                  value={acc.mapLink}
                  onChange={(e) => {
                    const next = [...draft.accommodations];
                    next[idx] = { ...acc, mapLink: e.target.value };
                    onChange({ ...draft, accommodations: next });
                  }}
                  placeholder="Google Maps Link"
                  className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                />
                <input
                  type="text"
                  value={acc.notes}
                  onChange={(e) => {
                    const next = [...draft.accommodations];
                    next[idx] = { ...acc, notes: e.target.value };
                    onChange({ ...draft, accommodations: next });
                  }}
                  placeholder="Notes / booking code"
                  className="sm:col-span-2 min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      accommodations: draft.accommodations.filter((_, i) => i !== idx),
                    })
                  }
                  className="text-xs text-[#991B1B] text-left cursor-pointer"
                >
                  Remove hotel
                </button>
              </div>
            ))}
          </div>

          {/* Gallery & FAQ & Spotify */}
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Gallery Photos ({draft.gallery.length})</h3>
              <label className="min-h-[38px] px-3 rounded-lg bg-[#1D1915] text-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Add Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleUpload(e.target.files?.[0], 'gallery', (id) =>
                      onChange({
                        ...draft,
                        gallery: [
                          ...draft.gallery,
                          { id: `gal-${Date.now()}`, assetId: id, fallbackUrl: '', caption: '' },
                        ],
                      })
                    )
                  }
                />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {draft.gallery.map((g, idx) => (
                <div key={g.id} className="p-3 rounded-lg border border-[#1D1915]/12 flex items-center gap-2">
                  <input
                    type="text"
                    value={g.caption}
                    onChange={(e) => {
                      const next = [...draft.gallery];
                      next[idx] = { ...g, caption: e.target.value };
                      onChange({ ...draft, gallery: next });
                    }}
                    placeholder="Caption"
                    className="flex-1 min-h-[36px] px-2.5 rounded border border-[#1D1915]/15 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        gallery: draft.gallery.filter((_, i) => i !== idx),
                      })
                    }
                    className="text-xs text-[#991B1B] cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#1D1915]/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">FAQs ({draft.faq.length})</h3>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      faq: [...draft.faq, { id: `faq-${Date.now()}`, question: '', answer: '' }],
                    })
                  }
                  className="min-h-[36px] px-3 rounded-lg border border-[#1D1915]/15 text-xs font-medium cursor-pointer"
                >
                  + Add FAQ
                </button>
              </div>
              {draft.faq.map((f, idx) => (
                <div key={f.id} className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={f.question}
                    onChange={(e) => {
                      const next = [...draft.faq];
                      next[idx] = { ...f, question: e.target.value };
                      onChange({ ...draft, faq: next });
                    }}
                    placeholder="Question"
                    className="min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={f.answer}
                      onChange={(e) => {
                        const next = [...draft.faq];
                        next[idx] = { ...f, answer: e.target.value };
                        onChange({ ...draft, faq: next });
                      }}
                      placeholder="Answer"
                      className="flex-1 min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ ...draft, faq: draft.faq.filter((_, i) => i !== idx) })
                      }
                      className="text-xs text-[#991B1B] px-2 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#1D1915]/10">
              <label className="block text-xs font-medium mb-1">
                Optional Spotify Playlist / Track URL
              </label>
              <input
                type="url"
                value={draft.spotifyUrl}
                onChange={(e) => onChange({ ...draft, spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/playlist/..."
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB: RSVP BUILDER */}
      {subTab === 'rsvp' && (
        <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">RSVP Deadline</label>
              <input
                type="date"
                value={draft.rsvpConfig.deadline}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    rsvpConfig: { ...draft.rsvpConfig, deadline: e.target.value },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Guests per RSVP</label>
              <input
                type="number"
                min={1}
                max={20}
                value={draft.rsvpConfig.maxGuests}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    rsvpConfig: { ...draft.rsvpConfig, maxGuests: Number(e.target.value) || 10 },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Rooms per RSVP</label>
              <input
                type="number"
                min={1}
                max={10}
                value={draft.rsvpConfig.maxRooms}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    rsvpConfig: { ...draft.rsvpConfig, maxRooms: Number(e.target.value) || 4 },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Family / Group Options (comma-separated)
            </label>
            <input
              type="text"
              value={draft.rsvpConfig.groups.join(', ')}
              onChange={(e) =>
                onChange({
                  ...draft,
                  rsvpConfig: {
                    ...draft.rsvpConfig,
                    groups: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
          </div>

          {/* Configurable Standard Fields */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5E554B]">
              Optional Field Controls
            </p>
            {(['email', 'group', 'allergies', 'accommodation', 'blessing'] as const).map(
              (key) => {
                const field = draft.rsvpConfig.fields[key];
                return (
                  <div
                    key={key}
                    className="grid sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-[#1D1915]/10"
                  >
                    <span className="sm:col-span-2 text-xs font-medium capitalize">{key}</span>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          rsvpConfig: {
                            ...draft.rsvpConfig,
                            fields: {
                              ...draft.rsvpConfig.fields,
                              [key]: { ...field, label: e.target.value },
                            },
                          },
                        })
                      }
                      className="sm:col-span-6 min-h-[36px] px-2.5 rounded border border-[#1D1915]/15 text-xs"
                    />
                    <label className="sm:col-span-2 flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={field.visible}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            rsvpConfig: {
                              ...draft.rsvpConfig,
                              fields: {
                                ...draft.rsvpConfig.fields,
                                [key]: { ...field, visible: e.target.checked },
                              },
                            },
                          })
                        }
                      />
                      Show
                    </label>
                    <label className="sm:col-span-2 flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            rsvpConfig: {
                              ...draft.rsvpConfig,
                              fields: {
                                ...draft.rsvpConfig.fields,
                                [key]: { ...field, required: e.target.checked },
                              },
                            },
                          })
                        }
                      />
                      Required
                    </label>
                  </div>
                );
              }
            )}
          </div>

          {/* Up to 5 Custom Questions */}
          <div className="space-y-3 pt-3 border-t border-[#1D1915]/10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Custom Questions ({draft.rsvpConfig.customQuestions.length} / 5)
              </p>
              {draft.rsvpConfig.customQuestions.length < 5 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      rsvpConfig: {
                        ...draft.rsvpConfig,
                        customQuestions: [
                          ...draft.rsvpConfig.customQuestions,
                          {
                            id: `q-${Date.now()}`,
                            label: 'Arrival time or flight details',
                            type: 'text',
                            required: false,
                            options: [],
                          },
                        ],
                      },
                    })
                  }
                  className="min-h-[36px] px-3 rounded-lg bg-[#1D1915] text-[#FAF7F2] text-xs cursor-pointer"
                >
                  + Add Question
                </button>
              )}
            </div>
            {draft.rsvpConfig.customQuestions.map((q, idx) => (
              <div key={q.id} className="p-3 rounded-lg border border-[#1D1915]/12 space-y-2">
                <div className="grid sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => {
                      const next = [...draft.rsvpConfig.customQuestions];
                      next[idx] = { ...q, label: e.target.value };
                      onChange({
                        ...draft,
                        rsvpConfig: { ...draft.rsvpConfig, customQuestions: next },
                      });
                    }}
                    className="sm:col-span-6 min-h-[36px] px-2.5 rounded border border-[#1D1915]/15 text-xs"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const next = [...draft.rsvpConfig.customQuestions];
                      next[idx] = { ...q, type: e.target.value as 'text' | 'choice' };
                      onChange({
                        ...draft,
                        rsvpConfig: { ...draft.rsvpConfig, customQuestions: next },
                      });
                    }}
                    className="sm:col-span-3 min-h-[36px] px-2 rounded border border-[#1D1915]/15 text-xs"
                  >
                    <option value="text">Short Text</option>
                    <option value="choice">Single Choice</option>
                  </select>
                  <label className="sm:col-span-2 flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => {
                        const next = [...draft.rsvpConfig.customQuestions];
                        next[idx] = { ...q, required: e.target.checked };
                        onChange({
                          ...draft,
                          rsvpConfig: { ...draft.rsvpConfig, customQuestions: next },
                        });
                      }}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        rsvpConfig: {
                          ...draft.rsvpConfig,
                          customQuestions: draft.rsvpConfig.customQuestions.filter(
                            (_, i) => i !== idx
                          ),
                        },
                      })
                    }
                    className="sm:col-span-1 text-xs text-[#991B1B] cursor-pointer"
                  >
                    Del
                  </button>
                </div>
                {q.type === 'choice' && (
                  <input
                    type="text"
                    value={q.options.join(', ')}
                    onChange={(e) => {
                      const next = [...draft.rsvpConfig.customQuestions];
                      next[idx] = {
                        ...q,
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      };
                      onChange({
                        ...draft,
                        rsvpConfig: { ...draft.rsvpConfig, customQuestions: next },
                      });
                    }}
                    placeholder="Options separated by commas"
                    className="w-full min-h-[36px] px-2.5 rounded border border-[#1D1915]/15 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: WISHLIST & UPI */}
      {subTab === 'wishlist' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold">Shared Wishlist Goal</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Wishlist Section Title</label>
                <input
                  type="text"
                  value={draft.wishlistConfig.title}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      wishlistConfig: { ...draft.wishlistConfig, title: e.target.value },
                    })
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Target Amount (INR)</label>
                <input
                  type="number"
                  min={100}
                  value={Math.round(draft.wishlistConfig.targetPaise / 100)}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      wishlistConfig: {
                        ...draft.wishlistConfig,
                        targetPaise: Math.max(100, Number(e.target.value) * 100),
                      },
                    })
                  }
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm tabular-nums"
                />
              </div>
            </div>
            <textarea
              rows={2}
              value={draft.wishlistConfig.story}
              onChange={(e) =>
                onChange({
                  ...draft,
                  wishlistConfig: { ...draft.wishlistConfig, story: e.target.value },
                })
              }
              className="w-full p-3 rounded-lg border border-[#1D1915]/15 text-sm"
            />
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.wishlistConfig.showTargetPublicly}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    wishlistConfig: {
                      ...draft.wishlistConfig,
                      showTargetPublicly: e.target.checked,
                    },
                  })
                }
              />
              <span>Show target amount and confirmed ₹ figures publicly</span>
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {(['partner1', 'partner2'] as const).map((key, idx) => {
              const ben = draft.wishlistConfig[key];
              return (
                <div
                  key={key}
                  className="bg-white border border-[#1D1915]/10 rounded-xl p-6 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold">Beneficiary {idx + 1}</h4>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={ben.enabled}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            wishlistConfig: {
                              ...draft.wishlistConfig,
                              [key]: { ...ben, enabled: e.target.checked },
                            },
                          })
                        }
                      />
                      Enable
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Display Name</label>
                    <input
                      type="text"
                      value={ben.displayName}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          wishlistConfig: {
                            ...draft.wishlistConfig,
                            [key]: { ...ben, displayName: e.target.value },
                          },
                        })
                      }
                      className="w-full min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">UPI ID</label>
                    <input
                      type="text"
                      value={ben.upiId}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          wishlistConfig: {
                            ...draft.wishlistConfig,
                            [key]: { ...ben, upiId: e.target.value },
                          },
                        })
                      }
                      placeholder="name@bank"
                      className="w-full min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Payee Legal Name</label>
                    <input
                      type="text"
                      value={ben.payeeName}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          wishlistConfig: {
                            ...draft.wishlistConfig,
                            [key]: { ...ben, payeeName: e.target.value },
                          },
                        })
                      }
                      placeholder="Shown inside UPI apps"
                      className="w-full min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Short Description</label>
                    <input
                      type="text"
                      value={ben.description}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          wishlistConfig: {
                            ...draft.wishlistConfig,
                            [key]: { ...ben, description: e.target.value },
                          },
                        })
                      }
                      className="w-full min-h-[38px] px-3 rounded border border-[#1D1915]/15 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <label className="min-h-[38px] px-3 rounded border border-dashed border-[#1D1915]/25 inline-flex items-center gap-1.5 text-xs cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {ben.qrAssetId ? 'Replace Static QR' : 'Upload Static QR'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleUpload(e.target.files?.[0], 'qr', (id) =>
                            onChange({
                              ...draft,
                              wishlistConfig: {
                                ...draft.wishlistConfig,
                                [key]: { ...ben, qrAssetId: id },
                              },
                            })
                          )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!ben.upiId.trim()}
                      onClick={() => openTestUpi(ben)}
                      className="min-h-[38px] px-3 rounded bg-[#1D1915] text-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Test payment link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: LABELS & ASSETS */}
      {subTab === 'labels' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">RSVP Button Text</label>
              <input
                type="text"
                value={draft.rsvpConfig.submitButtonText}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    rsvpConfig: { ...draft.rsvpConfig, submitButtonText: e.target.value },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Wishlist Button Text</label>
              <input
                type="text"
                value={draft.wishlistConfig.buttonText}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    wishlistConfig: { ...draft.wishlistConfig, buttonText: e.target.value },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">RSVP Thank-You Heading</label>
              <input
                type="text"
                value={draft.rsvpConfig.thankYouHeading}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    rsvpConfig: { ...draft.rsvpConfig, thankYouHeading: e.target.value },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Wishlist Thank-You Message</label>
              <input
                type="text"
                value={draft.wishlistConfig.thankYouMessage}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    wishlistConfig: { ...draft.wishlistConfig, thankYouMessage: e.target.value },
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>
          </div>

          <div className="bg-white border border-[#1D1915]/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">
                Stored Images ({assets.length} / {MAX_ASSETS_PER_WEDDING})
              </h3>
              <span className="text-xs text-[#5E554B]">Compressed WebP in Firestore</span>
            </div>
            {assets.length === 0 ? (
              <p className="text-sm text-[#5E554B]">No custom images uploaded yet.</p>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4">
                {assets.map((a) => (
                  <div key={a.id} className="border border-[#1D1915]/12 rounded-lg p-3 space-y-2">
                    <img
                      src={a.dataUrl}
                      alt={a.kind}
                      className="w-full h-28 object-cover rounded bg-[#FAF7F2]"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono">
                        {a.kind} · {Math.round(a.bytes / 1024)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => a.id && handleRemoveAsset(a.id)}
                        className="text-[#991B1B] underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test UPI Modal */}
      {testUpiModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <h4 className="text-lg font-semibold">Test ₹1 Payment Link</h4>
            <p className="text-xs text-[#5E554B]">
              {testUpiModal.payeeName} · <span className="font-mono">{testUpiModal.upiId}</span>
            </p>
            <img
              src={testUpiModal.qrUrl}
              alt="Test UPI QR"
              className="w-48 h-48 mx-auto rounded-lg border border-[#1D1915]/12"
            />
            <div className="flex gap-2 justify-center">
              <a
                href={testUpiModal.upiUri}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#7C5821] text-white text-xs font-medium inline-flex items-center"
              >
                Open UPI App
              </a>
              <button
                type="button"
                onClick={() => setTestUpiModal(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[#1D1915]/15 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
