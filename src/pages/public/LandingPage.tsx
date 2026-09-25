import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Gavel,
  Lock,
  BookOpen,
  FileText,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Layers,
  Database,
  Building2,
  Users,
  Award,
  ExternalLink,
  ShieldAlert,
  Search,
  Zap,
  Globe
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does Legal Vault integrate with the National Judicial Data Grid (NJDG)?',
      a: 'Legal Vault bridges seamlessly with NJDG e-Courts APIs using encrypted bi-directional connectors. Cause lists, party names, and case numbers synchronize in real-time, feeding statutory data into the AI precedent engine.'
    },
    {
      q: 'Is evidence stored on the blockchain tamper-proof and admissible under Indian Law?',
      a: 'Yes. Evidence uploaded to Legal Vault is cryptographically hashed (SHA-256) and anchored onto a Hyperledger permissioned blockchain. In accordance with Section 65B of the Indian Evidence Act (and Section 63 of Bharatiya Sakshya Adhiniyam, 2023), every file generates an automated 65B compliance certificate.'
    },
    {
      q: 'How does the AI Copilot guarantee accuracy without hallucinating fake precedents?',
      a: 'The Legal Vault AI engine uses Retrieval-Augmented Generation (RAG) strictly bounded to verified Supreme Court Reports (SCR), High Court judgments, and statutory codes. Every citation provided includes exact paragraph and page numbers verified against official data stores.'
    },
    {
      q: 'Can judicial officers draft orders directly within the workspace?',
      a: 'Absolutely. The Judge Workspace features an automated order synthesis engine that drafts preliminary bail, interim injunction, or procedural orders based on hearing transcripts, pleadings, and precedent analysis.'
    }
  ];

  return (
    <div className="bg-surface-subtle text-foreground overflow-hidden">
      
      {/* SECTION 1: HERO (WHITE / LIGHT BG) */}
      <section className="relative px-4 md:px-8 py-16 md:py-24 max-w-7xl mx-auto border-b border-border">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary text-white text-xs font-mono font-bold tracking-wider uppercase shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Judicial Intelligence Platform • Republic of India</span>
          </div>

          {/* Large Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-heading tracking-tight text-foreground leading-[1.05]">
            AI Powered Judicial Intelligence Platform
          </h1>

          {/* Minimal Editorial Subtitle */}
          <p className="text-base sm:text-lg text-[#555555] dark:text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed font-sans">
            Engineered for the Supreme Court of India, High Courts, and Advocate Chambers. Accelerate dispute resolution, verify immutable evidence, and synthesize neural legal research.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/role-selection">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Platform
              </Button>
            </Link>
            <Link to="/documentation">
              <Button variant="outline" size="lg">
                Read Documentation
              </Button>
            </Link>
          </div>
        </div>

        {/* Large Edge-To-Edge Monochrome Hero Imagery */}
        <div className="mt-12 md:mt-16 relative rounded-2xl overflow-hidden border border-border shadow-2xl group bg-[#111111]">
          <img
            src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1600"
            alt="Supreme Court Courtroom"
            className="w-full h-[380px] sm:h-[500px] lg:h-[600px] object-cover grayscale contrast-125 filter opacity-85 group-hover:scale-102 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/30 to-transparent"></div>

          {/* Image Overlay Cards */}
          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 text-white">
            <div className="bg-[#111111]/90 backdrop-blur-md p-4 md:p-6 rounded-xl border border-white/10 max-w-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#A1A1AA]">
                <Scale className="w-4 h-4" />
                <span>SUPREME COURT OF INDIA — COURT HALL 01</span>
              </div>
              <h3 className="font-heading font-bold text-base md:text-lg text-white">
                Constitutional Bench Proceedings Synchronized in Real-Time
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Neural precedent indexing actively processes 100+ years of SCR judgments against active cause lists.
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-6 bg-[#111111]/90 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-xs font-mono">
              <div>
                <div className="text-[10px] text-[#A1A1AA] uppercase">ACTIVE CAUSE LIST</div>
                <div className="font-bold text-white">3,842 Cases Today</div>
              </div>
              <div className="h-6 w-px bg-white/20"></div>
              <div>
                <div className="text-[10px] text-[#A1A1AA] uppercase">BLOCKCHAIN HASH</div>
                <div className="font-bold text-white">0x8f2a...9c4e Verified</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* SECTION 2: TRUSTED BY (BLACK BG) */}
      <section className="bg-[#111111] text-white py-16 px-4 md:px-8 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#A1A1AA]">
              INSTITUTIONAL TRUST & INTEGRATION
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-white">
              Deployed Across India's Highest Judicial Bodies
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center items-center">
            {[
              'Supreme Court of India',
              'Delhi High Court',
              'Bombay High Court',
              'Bar Council of India',
              'Law Commission',
              'Bar Association'
            ].map((name, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] text-xs font-heading font-bold text-[#D4D4D4] hover:border-white transition-colors flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4 text-white" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* SECTION 3: FEATURES (EDITORIAL LIGHT BG) */}
      <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto space-y-16 border-b border-border">
        <div className="max-w-3xl space-y-4">
          <div className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-widest">
            PLATFORM ARCHITECTURE
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-heading text-foreground leading-tight">
            Engineered with Supreme Precision for the Bench and Bar
          </h2>
          <p className="text-base text-[#555555] dark:text-[#A1A1AA] leading-relaxed">
            Legal Vault replaces fragmented paper registers and slow manual research with a cohesive, high-speed judicial OS built on three core pillars.
          </p>
        </div>

        {/* Feature Grid with Photography */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden space-y-6 p-6 shadow-xs group hover:border-primary transition-colors">
            <div className="h-48 rounded-xl overflow-hidden bg-[#111111] relative">
              <img
                src="https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&q=80&w=800"
                alt="Law Library"
                className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 opacity-90"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#111111]/90 text-white font-mono text-[10px] border border-white/10">
                MODULE 01
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white dark:text-[#111111]" />
              </div>
              <h3 className="font-heading font-extrabold text-lg text-foreground">
                Neural Precedent Engine
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed">
                Vector-indexed database housing over 100 years of Supreme Court Reports (SCR) and High Court benches with instant semantic ratio extraction.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden space-y-6 p-6 shadow-xs group hover:border-primary transition-colors">
            <div className="h-48 rounded-xl overflow-hidden bg-[#111111] relative">
              <img
                src="https://images.unsplash.com/photo-1453728013993-6d66e9c9123a?auto=format&fit=crop&q=80&w=800"
                alt="Scales of Justice"
                className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 opacity-90"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#111111]/90 text-white font-mono text-[10px] border border-white/10">
                MODULE 02
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                <Lock className="w-4 h-4 text-white dark:text-[#111111]" />
              </div>
              <h3 className="font-heading font-extrabold text-lg text-foreground">
                Hyperledger Evidence Vault
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed">
                256-bit cryptographic SHA-256 evidence hashing guaranteeing chain-of-custody compliance under Section 65B of the Indian Evidence Act.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden space-y-6 p-6 shadow-xs group hover:border-primary transition-colors">
            <div className="h-48 rounded-xl overflow-hidden bg-[#111111] relative">
              <img
                src="https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&q=80&w=800"
                alt="Legal Documents"
                className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 opacity-90"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#111111]/90 text-white font-mono text-[10px] border border-white/10">
                MODULE 03
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                <FileText className="w-4 h-4 text-white dark:text-[#111111]" />
              </div>
              <h3 className="font-heading font-extrabold text-lg text-foreground">
                Automated Bench Draft Generator
              </h3>
              <p className="text-xs text-[#555555] dark:text-[#A1A1AA] leading-relaxed">
                Generates court orders, bail mandates, and notice templates formatted strictly according to Supreme Court Rules 2013 and High Court practice codes.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* SECTION 4: AI CAPABILITIES (DARK BG) */}
      <section className="bg-[#111111] text-white py-20 px-4 md:px-8 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs font-mono font-bold text-[#A1A1AA] uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                NEURAL INTELLIGENCE
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white">
                Legal Vault AI: Unrivaled Statutory & Precedent Precision
              </h2>
            </div>
            <Link to="/app/research">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-[#111111]">
                Try Research Copilot <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Ratio Decidendi Extraction',
                desc: 'Automatically isolates the core binding legal holding from lengthy 200-page Constitution Bench judgments.',
                icon: Cpu
              },
              {
                title: 'Section Conflict Detector',
                desc: 'Flags overlapping or conflicting statutory sections across IPC/BNS, CrPC/BNSS, and Evidence Act.',
                icon: ShieldAlert
              },
              {
                title: 'Bail Probability Predictor',
                desc: 'Analyzes charge sheet metrics and landmark Supreme Court bail rulings to predict order outcomes.',
                icon: BarChart3
              },
              {
                title: 'Multi-Lingual Vernacular OCR',
                desc: 'Translates and indexes lower court records in Hindi, Tamil, Marathi, Bengali, and 12 Indian languages.',
                icon: Globe
              }
            ].map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] space-y-3 hover:border-white transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white text-[#111111] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#111111]" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-white">{cap.title}</h3>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">{cap.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* SECTION 5: BLOCKCHAIN SECURITY (LIGHT BG) */}
      <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto border-b border-border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="text-xs font-mono font-bold text-foreground-muted uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-4 h-4" />
              CRYPTOGRAPHIC INTEGRITY
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-foreground leading-tight">
              256-Bit Immutable Evidence Ledger
            </h2>
            <p className="text-sm text-[#555555] dark:text-[#A1A1AA] leading-relaxed">
              Every document uploaded into a case file is cryptographically registered on the Legal Vault Hyperledger ledger. Any downstream modification immediately invalidates the block hash, ensuring absolute court proofing.
            </p>

            <ul className="space-y-3 text-xs font-sans text-foreground">
              {[
                'Automated Section 65B Indian Evidence Act Certificate Generation',
                'Cryptographic Digital Signatures for Judicial Officers & Registrars',
                'Zero-Knowledge Privacy Architecture for Sealed Cover Evidence',
                'Immutable Audit Trail Logged across National Judicial Nodes'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <Link to="/app/blockchain">
                <Button variant="primary">
                  Inspect Blockchain Ledger Node <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-[#111111] text-white border border-[#2A2A2A] space-y-6 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-white font-bold">HYPERLEDGER BLOCK #849204</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">
                VERIFIED IMMUTABLE
              </span>
            </div>

            <div className="space-y-2 text-[11px] text-[#A1A1AA]">
              <div>
                <span className="text-white font-bold">Case ID:</span> SC/2026/CRL-49102
              </div>
              <div>
                <span className="text-white font-bold">Document:</span> Certified_Charge_Sheet_Central_Bureau.pdf
              </div>
              <div>
                <span className="text-white font-bold">SHA-256 Hash:</span>
                <p className="text-white bg-[#1B1B1B] p-2 rounded border border-[#2A2A2A] mt-1 break-all text-[10px]">
                  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </p>
              </div>
              <div>
                <span className="text-white font-bold">Timestamp:</span> 2026-07-22 10:14:02 IST (NTP Synced)
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-[10px] text-foreground-muted text-center">
              Signer: High Court Registry Digital Key #HC-DELHI-09
            </div>
          </div>
        </div>
      </section>


      {/* SECTION 6: PLATFORM WORKFLOW (DARK BG) */}
      <section className="bg-[#111111] text-white py-20 px-4 md:px-8 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="text-xs font-mono font-bold text-[#A1A1AA] uppercase tracking-widest">
              END-TO-END WORKFLOW
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white">
              How Legal Vault Transforms Case Disposal
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {[
              {
                step: '01',
                title: 'E-Filing & OCR',
                desc: 'Pleadings, charge sheets, and annexures uploaded via web or e-Courts grid.'
              },
              {
                step: '02',
                title: 'Ledger Hashing',
                desc: 'Files cryptographically signed and SHA-256 anchored on Hyperledger.'
              },
              {
                step: '03',
                title: 'AI Analysis',
                desc: 'Neural Copilot extracts statutory sections, ratio decidendi, and precedent cases.'
              },
              {
                step: '04',
                title: 'Bench Order',
                desc: 'Judicial Officer reviews split PDF & AI brief to generate signed court order.'
              }
            ].map((st, i) => (
              <div
                key={i}
                className="p-6 rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] space-y-4 hover:border-white transition-colors"
              >
                <div className="text-2xl font-mono font-bold text-white">{st.step}</div>
                <h3 className="font-heading font-bold text-base text-white">{st.title}</h3>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* SECTION 7: STATISTICS (LIGHT BG) */}
      <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '74%', label: 'Case Pendency Latency Reduction' },
            { num: '2.4M+', label: 'Supreme Court & High Court Precedents' },
            { num: '100%', label: 'Cryptographic Audit Integrity' },
            { num: '450+', label: 'Connected District & High Courts' }
          ].map((stat, idx) => (
            <div key={idx} className="space-y-2">
              <div className="text-4xl sm:text-5xl font-black font-heading text-foreground">
                {stat.num}
              </div>
              <div className="text-xs font-medium text-[#555555] dark:text-[#A1A1AA] max-w-[180px] mx-auto">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* SECTION 8: FAQ (DARK BG) */}
      <section className="bg-[#111111] text-white py-20 px-4 md:px-8 border-b border-[#2A2A2A]">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="text-xs font-mono font-bold text-[#A1A1AA] uppercase tracking-widest">
              FREQUENTLY ASKED QUESTIONS
            </div>
            <h2 className="text-3xl font-extrabold font-heading text-white">
              Technical & Legal Governance
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-[#1B1B1B] border border-[#2A2A2A] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-heading font-bold text-sm text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-white transition-transform ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs text-[#A1A1AA] leading-relaxed border-t border-[#2A2A2A] pt-3 font-sans">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* SECTION 9: CALL TO ACTION (EDGE-TO-EDGE LIGHT BG WITH BLACK CTA CARD) */}
      <section className="py-20 px-4 md:px-8 max-w-7xl mx-auto text-center">
        <div className="p-10 md:p-16 rounded-3xl bg-[#111111] text-white space-y-6 relative overflow-hidden border border-[#2A2A2A] shadow-2xl">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white font-mono text-xs font-bold uppercase tracking-widest">
              <Gavel className="w-3.5 h-3.5" />
              <span>THE FUTURE OF INDIAN JUDICIARY</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black font-heading text-white leading-tight">
              Ready to Experience Judicial Intelligence?
            </h2>
            <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
              Join judges, senior advocate chambers, and legal researchers across India using Legal Vault today.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/role-selection">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Case Workspace
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-[#111111]">
                Contact Registry
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};
