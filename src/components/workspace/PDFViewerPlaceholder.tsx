import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Search,
  Highlighter,
  RotateCw,
  ShieldCheck,
  FileText,
  Lock,
  Eye,
  Sparkles
} from 'lucide-react';
import { Button } from '../common/Button';

interface PDFViewerPlaceholderProps {
  title?: string;
  documentHash?: string;
  pageCount?: number;
}

export const PDFViewerPlaceholder: React.FC<PDFViewerPlaceholderProps> = ({
  title = 'Title_Deed_DL_2018_994_Certified.pdf',
  documentHash = '0x8f2a93c14d9e02318b7623a9d8011c210ab43912e73491f0923e110c921782e1',
  pageCount = 18,
}) => {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHighlighting, setIsHighlighting] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 50));

  return (
    <div className="flex flex-col h-full bg-surface-subtle border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Document Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary text-white shrink-0">
            <FileText className="w-4 h-4 text-white dark:text-[#111111]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-foreground truncate font-heading">
              {title}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-foreground-muted font-mono">
              <span className="text-foreground font-semibold">256-Bit Signed</span>
              <span>•</span>
              <span>{pageCount} Pages</span>
            </div>
          </div>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Zoom */}
          <div className="flex items-center bg-[#FAFAF8] dark:bg-[#222225] rounded-lg border border-border p-0.5 text-xs font-mono">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-white dark:hover:bg-[#2C2C30] rounded transition-colors text-foreground-muted"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 min-w-[42px] text-center text-foreground">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-white dark:hover:bg-[#2C2C30] rounded transition-colors text-foreground-muted"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page Navigator */}
          <div className="flex items-center bg-[#FAFAF8] dark:bg-[#222225] rounded-lg border border-border p-0.5 text-xs font-mono">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1 disabled:opacity-30 hover:bg-white dark:hover:bg-[#2C2C30] rounded transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-foreground">
              {currentPage} / {pageCount}
            </span>
            <button
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, pageCount))}
              className="p-1 disabled:opacity-30 hover:bg-white dark:hover:bg-[#2C2C30] rounded transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Highlight toggle */}
          <button
            onClick={() => setIsHighlighting(!isHighlighting)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isHighlighting
                ? 'bg-[#111111] border-[#111111] text-white dark:bg-white dark:border-white dark:text-[#111111]'
                : 'bg-transparent border-border text-foreground-muted'
            }`}
            title="Toggle AI Statutory Highlight"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-lg border border-border text-foreground-muted hover:text-foreground transition-colors"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Document View Canvas */}
      <div className="flex-1 overflow-auto p-6 flex justify-center bg-[#F2F2EF] dark:bg-[#0A0A0B] relative">
        {/* Page Render Container */}
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="w-full max-w-2xl bg-white text-[#111111] shadow-2xl rounded-sm p-10 md:p-14 min-h-[720px] transition-transform duration-150 relative border border-[#E7E5E4]"
        >
          {/* Government Watermark Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
            <div className="text-center font-heading font-black text-6xl tracking-widest uppercase text-black">
              SUPREME COURT OF INDIA<br />JUDICIAL VAULT
            </div>
          </div>

          {/* Document Header */}
          <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-widest uppercase font-bold text-gray-700">
                HIGH COURT OF JUDICATURE AT DELHI
              </div>
              <h2 className="text-xl font-heading font-extrabold text-black mt-1">
                CERTIFIED COPY OF REGISTERED SALE DEED
              </h2>
              <div className="text-xs font-mono text-gray-600 mt-0.5">
                SUB-REGISTRAR OFFICE IX • NEW DELHI • REGISTER NO. DL-2018-994
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center text-[9px] font-bold text-black text-center p-1 leading-tight font-mono">
              SEAL OF REGISTRAR
            </div>
          </div>

          {/* Page Body Content */}
          <div className="space-y-4 text-xs font-serif leading-relaxed text-gray-800">
            <p>
              <strong className="font-sans font-bold text-black">THIS DEED OF CONVEYANCE</strong> is executed on this 12th day of January 2018 between Mehta Property Developers Ltd. (hereinafter referred to as the <em className="bg-gray-200 px-1 font-sans not-italic font-bold">VENDOR</em>) and Delhi Development Authority (hereinafter referred to as the <em className="bg-gray-200 px-1 font-sans not-italic font-bold">PURCHASER</em>).
            </p>

            <div className="p-3 bg-gray-50 border-l-2 border-black my-3 font-sans text-[11px] leading-normal text-gray-700">
              <strong className="text-black uppercase tracking-wider block text-[10px] mb-1 font-mono">
                SCHEDULE OF PROPERTY (PARCEL ID #DL-994-A)
              </strong>
              All that piece and parcel of land measuring 14.2 Acres situated in Survey Plot No. 402/1, Sector 18, Mehrauli Tehsil, District South Delhi, bounded on the North by Ring Road and South by DDA Public Reserve.
            </div>

            <p>
              WHEREAS the VENDOR is the absolute lawful owner in possession of the schedule land, free from all encumbrances, litigation, attachments, or court stays. The agreed total consideration is ₹32,40,00,000 (Rupees Thirty Two Crores Forty Lakhs Only).
            </p>

            {isHighlighting && (
              <div className="p-3 rounded bg-gray-100 border border-gray-300 text-black font-sans text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1 text-black">
                  <Sparkles className="w-3.5 h-3.5" /> AI Statutory Highlight (RFCTLARR Act Sec 26):
                </div>
                <p>
                  Land acquisition market value calculation clause flagged. Solatium @ 100% mandatory under Section 30.
                </p>
              </div>
            )}

            <p>
              IN WITNESS WHEREOF, the parties hereto have set their hands and seals on the date, month, and year first written above in the presence of attending witnesses.
            </p>
          </div>

          {/* Document Footer Signatures */}
          <div className="mt-16 pt-6 border-t border-gray-300 flex items-center justify-between font-sans text-[11px]">
            <div>
              <div className="font-bold text-black">ADV. ANANYA SUBRAMANIAN</div>
              <div className="text-gray-500">Counsel for Petitioner</div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1 font-mono text-[10px] text-success bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Digital Seal Verified
              </div>
              <div className="text-[9px] text-gray-500 font-mono mt-1">
                Hash: {documentHash.slice(0, 16)}...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
