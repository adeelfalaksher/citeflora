'use client';

import Link from 'next/link';
import type {ReactNode} from 'react';
import {ArrowRight, ArrowUpRight, Download, FileText, ListChecks} from 'lucide-react';
import corpus from '../data/corpus.json';
import {extractClaims} from '../lib/engine.mjs';
import {Mark} from './ui';

type WelcomeProps = {
  onGuide: () => void;
  onWorkspace: () => void;
  onImport: () => void;
  onMethods: () => void;
  connected: boolean;
};

const starterEntries = corpus.map(source => ({source, claims: extractClaims(source.text, source).claims}));
const starterClaims = starterEntries.flatMap(entry => entry.claims);
const starterRows = corpus.reduce((count, source) => count + source.rowCount, 0);
const starterTaxa = new Set(starterClaims.map(claim => claim.candidates.length === 1 ? claim.candidates[0] : claim.plantName)).size;
const exampleEntry = starterEntries.find(entry => entry.source.key === 'PMC10424924') || starterEntries[0];
const exampleClaim = exampleEntry.claims.find(claim => claim.plantName === 'Hypericum perforatum' && claim.category === 'Wounds');

function ExamplePassage() {
  if (!exampleClaim) return null;
  const spans = [
    {start: exampleClaim.plantStart - exampleClaim.start, end: exampleClaim.plantEnd - exampleClaim.start, kind: 'plant'},
    {start: exampleClaim.useStart - exampleClaim.start, end: exampleClaim.useEnd - exampleClaim.start, kind: 'use'},
  ].sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor || span.start < 0 || span.end > exampleClaim.quote.length) continue;
    parts.push(exampleClaim.quote.slice(cursor, span.start));
    parts.push(<mark key={span.kind} className={'welcome-highlight welcome-highlight-' + span.kind}>{exampleClaim.quote.slice(span.start, span.end)}</mark>);
    cursor = span.end;
  }
  parts.push(exampleClaim.quote.slice(cursor));
  return <blockquote className="welcome-quote">{parts}</blockquote>;
}

const questions = [
  {
    title: 'What does Citeflora actually do?',
    answer: 'It proposes plant and reported use records from English text using a deterministic rule engine. Each candidate points to the exact passage in a saved source snapshot. You check the result, record a decision, and export the evidence. It is not a trained AI model.',
  },
  {
    title: 'Who is it for?',
    answer: 'Researchers, students, and data curators working with published ethnobotanical literature. It helps organize and inspect reported knowledge. It does not provide personal health advice or identify plants from photographs.',
  },
  {
    title: 'Where does the starter material come from?',
    answer: `The starter corpus contains ${starterRows} selected table rows from ${corpus.length} attributed CC BY studies, covering ${starterTaxa} source-reported taxa. It is a small working corpus, not the full papers, a comprehensive literature review, or new field research.`,
  },
  {
    title: 'Does an accepted record mean a treatment works?',
    answer: 'No. Acceptance records your review of the extraction against its source. A traditional use report does not establish clinical effectiveness or safety. Taxonomy suggestions also do not establish the identity of a historical specimen.',
  },
  {
    title: 'Can I bring my own sources?',
    answer: 'Yes. Paste permitted English text, upload a UTF-8 .txt or .md file, or use the six-column CSV template. You can also search Europe PMC and prepare a narrative import when its licence is supported. Add the citation and permission basis before saving.',
  },
  {
    title: 'How are my reviews saved?',
    answer: 'Sources and review decisions are stored in Cloudflare D1 in a workspace associated with this browser. The session cookie lasts 30 days. There are no user accounts or cross-device sync. Export CSV, JSON, or a printable HTML report to keep a portable copy.',
  },
];

export default function Welcome({onGuide, onWorkspace, onImport, onMethods, connected}: WelcomeProps) {
  return <div className="welcome">
    <a className="welcome-skip" href="#welcome-main">Skip to content</a>
    <header className="welcome-header">
      <a className="welcome-brand" href="#welcome-main" aria-label="Citeflora home"><Mark/><span>Citeflora</span></a>
      <nav className="welcome-nav" aria-label="Introduction navigation">
        <a href="#welcome-workflow">How it works</a>
        <button type="button" onClick={onMethods}>Methods</button>
        <button type="button" className="welcome-workspace-link" onClick={onWorkspace}>Open workspace <ArrowUpRight size={15}/></button>
      </nav>
    </header>

    <main id="welcome-main" className="welcome-main">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-hero-copy">
          <p className="welcome-eyebrow"><span className="welcome-edition">EthnoHack 2026</span> Traditional Knowledge Mining</p>
          <h1 id="welcome-title">Plant knowledge.<br/><span>With a paper trail.</span></h1>
          <p className="welcome-intro">Find proposed plant use records in published sources. Check the original passage, record your review, and export the evidence with its context intact.</p>
          <div className="welcome-hero-actions">
            <button type="button" className="welcome-primary" onClick={onGuide} disabled={!connected}>Try the guided example <ArrowRight size={18}/></button>
            <p className="welcome-action-note">No account needed. Use a real source from the starter corpus.</p>
            {!connected && <p className="welcome-connection-note" role="status">The example opens when your workspace connects.</p>}
          </div>
          <div className="welcome-hero-index" aria-label="Workflow summary"><span>01 Source</span><span>02 Review</span><span>03 Export</span></div>
        </div>

        <article className="welcome-example" aria-labelledby="welcome-example-title">
          <div className="welcome-example-top"><span className="welcome-example-label">Example from the starter corpus</span><span className="welcome-example-number">Table / 03</span></div>
          <div className="welcome-example-heading">
            <p className="welcome-eyebrow">Proposed extraction</p>
            <h2 id="welcome-example-title"><i>{exampleClaim?.plantName || 'Hypericum perforatum'}</i></h2>
            <p className="welcome-example-relation">Reported use <ArrowRight size={15}/> <strong>{String(exampleClaim?.category || 'Wounds')}</strong></p>
          </div>
          <div className="welcome-passage-label"><FileText size={14}/><span>Original source passage</span></div>
          <ExamplePassage/>
          <div className="welcome-example-facts">
            <div><span>Plant part</span><p>{exampleClaim?.plantPart}</p></div>
            <div><span>Preparation</span><p>{exampleClaim?.preparation}</p></div>
          </div>
          <div className="welcome-example-citation">
            <cite>{exampleEntry.source.authors.split(',')[0]} et al. · {exampleEntry.source.year}</cite>
            <p>{exampleEntry.source.locator} · {exampleEntry.source.licence}</p>
            <a href={exampleEntry.source.url} target="_blank" rel="noopener noreferrer">DOI {exampleEntry.source.doi} <ArrowUpRight size={13}/></a>
          </div>
          <div className="welcome-example-bottom"><span className="welcome-pending"><span aria-hidden="true"/>Awaiting human review</span><button type="button" onClick={onGuide} disabled={!connected} aria-label="Inspect this starter example">Inspect record <ArrowRight size={15}/></button></div>
        </article>
      </section>

      <section className="welcome-evidence-strip" aria-label="Starter corpus scope">
        <div className="welcome-evidence-intro"><span className="welcome-eyebrow">Start with the sources</span><p>Published material.<br/>Clearly bounded.</p></div>
        <div className="welcome-evidence-stat"><strong>{corpus.length.toString().padStart(2, '0')}</strong><span>Published studies</span></div>
        <div className="welcome-evidence-stat"><strong>{starterRows}</strong><span>Selected table rows</span></div>
        <div className="welcome-evidence-stat"><strong>{starterTaxa}</strong><span>Source-reported taxa</span></div>
        <p className="welcome-evidence-note">A starter corpus for inspection.<br/>No independent accuracy validation claimed.</p>
      </section>

      <section id="welcome-workflow" className="welcome-workflow" aria-labelledby="welcome-workflow-title">
        <div className="welcome-section-heading"><p className="welcome-eyebrow">The workflow</p><h2 id="welcome-workflow-title">From a passage<br/>to a reviewable record.</h2><p>One source trail, through every step.</p></div>
        <ol className="welcome-steps">
          <li><div className="welcome-step-top"><span>01</span><FileText size={23}/></div><h3>Bring the source.</h3><p>Choose a starter paper or import permitted text. Citeflora saves the snapshot and citation, then proposes plant use records.</p><span className="welcome-step-detail">Text, supported files, or open literature</span></li>
          <li><div className="welcome-step-top"><span>02</span><ListChecks size={23}/></div><h3>Check the record.</h3><p>Read the highlighted passage. Inspect identity and uncertainty, correct fields when needed, and save your review decision.</p><span className="welcome-step-detail">Original extraction stays unchanged</span></li>
          <li><div className="welcome-step-top"><span>03</span><Download size={23}/></div><h3>Keep the trail.</h3><p>Explore reported associations and download your records with citations, review status, source spans, and recorded uncertainty.</p><span className="welcome-step-detail">CSV, JSON, or a printable report</span></li>
        </ol>
      </section>

      <section className="welcome-principle" aria-labelledby="welcome-principle-title">
        <p className="welcome-eyebrow">Context is part of the finding</p>
        <div className="welcome-principle-grid"><h2 id="welcome-principle-title">The plant.<br/>The passage.<br/><span>The provenance.</span></h2><div className="welcome-principle-copy"><p>A plant name and a use are only the beginning. The original wording, preparation, citation, and uncertainty matter when someone checks the record later.</p><p>Citeflora keeps that context attached. Your corrections and decisions sit beside the extraction, with a review history you can inspect.</p><button type="button" className="welcome-text-link" onClick={onMethods}>See how the method works <ArrowUpRight size={16}/></button></div></div>
      </section>

      <section className="welcome-paths" aria-label="Choose your starting point">
        <article className="welcome-path"><span className="welcome-eyebrow">For researchers</span><h2>Bring your next source.</h2><p>Build a collection you can check. Import a permitted passage, inspect the proposed records, and preserve the reasons behind your decisions.</p><button type="button" className="welcome-secondary" onClick={onImport} disabled={!connected}>Add a research source <ArrowRight size={17}/></button></article>
        <article className="welcome-path"><span className="welcome-eyebrow">For judges and first visits</span><h2>Follow one real record.</h2><p>Open a published source, inspect its passage, save a review, and export the result. The guided example uses the working application.</p><button type="button" className="welcome-text-link" onClick={onGuide} disabled={!connected}>Walk through the example <ArrowRight size={17}/></button></article>
      </section>

      <section className="welcome-faq" aria-labelledby="welcome-faq-title">
        <div className="welcome-section-heading"><p className="welcome-eyebrow">Before you begin</p><h2 id="welcome-faq-title">A clear scope.<br/>An inspectable method.</h2></div>
        <div className="welcome-questions">{questions.map((question, index) => <details key={question.title} className="welcome-question"><summary><span className="welcome-question-number">{String(index + 1).padStart(2, '0')}</span><span>{question.title}</span><span className="welcome-question-toggle" aria-hidden="true">+</span></summary><p>{question.answer}</p></details>)}</div>
      </section>

      <section className="welcome-final" aria-labelledby="welcome-final-title"><p className="welcome-eyebrow">Start with one source</p><div className="welcome-final-row"><h2 id="welcome-final-title">Make the next record<br/>one you can trace.</h2><button type="button" className="welcome-secondary" onClick={onWorkspace}>Open your workspace <ArrowRight size={18}/></button></div><p className="welcome-final-note">Research records and reported associations. No treatment recommendations.</p></section>
    </main>

    <footer className="welcome-footer"><div className="welcome-footer-brand"><Mark/><span>Citeflora</span></div><p>Built for EthnoHack 2026 · Traditional Knowledge Mining</p><div className="welcome-footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Research use</Link><button type="button" onClick={onMethods}>Methods and limits <ArrowUpRight size={13}/></button><a href="https://github.com/adeelfalaksher900-creator/citeflora" target="_blank" rel="noopener noreferrer">Source code <ArrowUpRight size={13}/></a></div></footer>
  </div>;
}
