import { useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Code2, Play, Upload, RotateCcw, FileText, Copy, Check } from 'lucide-react';
import { PdfViewer, type ViewerLabels } from '@kyrven/react-pdf-viewer/static';

const labels: ViewerLabels = {
  viewer: 'PDF viewer', viewport: 'PDF pages', documentViewer: 'Document viewer', documentViewport: 'Document content',
  page: 'Page', previousPage: 'Previous page', nextPage: 'Next page', pageImage: n => `Page ${n}`, image: 'Image',
  zoom: 'Zoom', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fitWidth: 'Fit width', fitPage: 'Fit page', rotate: 'Rotation',
  rotateLeft: 'Rotate left', rotateRight: 'Rotate right', downloadPdf: 'Download PDF', downloadImage: 'Download image',
  openingPdf: 'Opening PDF…', openingDocument: 'Opening document…', settings: 'Options', layout: 'Layout',
  continuous: 'Continuous scroll', single: 'Single page', appearance: 'Appearance', light: 'Light', dark: 'Dark', system: 'System',
  error: () => 'This PDF could not be opened. Try another file or reset the demo.',
};
const code = `import { PdfViewer } from '@kyrven/react-pdf-viewer/static';

// Copy engine assets: npx hayro-pdf-assets public/hayro
export default function Reader() {
  return (
    <PdfViewer
      src="/sample.pdf"
      assetsUrl="/hayro"
      options={{
        height: '640px',
        initialZoom: 'fit-page',
        theme: 'dark',
        rememberTheme: false,
        accentColor: '#2CFF05',
      }}
    />
  );
}`;
export default function Playground() {
  const [source, setSource] = useState<string | File>('/sample.pdf');
  const [status, setStatus] = useState('Opening sample document…');
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function selectFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setStatus('Choose a PDF file to continue.'); return; }
    if (file.size > 64 * 1024 * 1024) { setStatus('Choose a PDF smaller than 64 MiB.'); return; }
    setStatus('Opening your document…'); setSource(file);
  }
  return <Tabs.Root defaultValue="preview" className="playground">
    <div className="playground-bar">
      <Tabs.List aria-label="Demo view" className="demo-tabs">
        <Tabs.Trigger value="preview"><Play size={15} /> Try it live</Tabs.Trigger>
        <Tabs.Trigger value="code"><Code2 size={17} /> Code</Tabs.Trigger>
      </Tabs.List>
      <div className="demo-actions"><button className="reset-button" aria-label="Reset to sample PDF" onClick={() => { setSource('/sample.pdf'); setStatus('Sample document selected'); }}><RotateCcw size={16} /></button><button className="upload-button" onClick={() => input.current?.click()}><Upload size={16} /> <span>Open your PDF</span></button></div>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
    <Tabs.Content value="preview" className="demo-panel" forceMount onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}>
      <div className="document-caption"><FileText size={15} /><span>{typeof source === 'string' ? 'The Kyrven field guide.pdf' : source.name}</span><span>Local rendering</span></div>
      <PdfViewer src={source} assetsUrl="/hayro" labels={labels} options={{ height: '640px', initialZoom: 'fit-page', theme: 'dark', rememberTheme: false, accentColor: '#2CFF05' }} onLoad={count => setStatus(`${count} pages ready. Try zooming, rotating, or opening your own PDF.`)} onError={() => setStatus('Unable to open this PDF. Try a different document or reset the demo.')} />
    </Tabs.Content>
    <Tabs.Content value="code" className="code-panel"><div className="code-caption"><span>Reader.tsx</span><button onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setStatus('Select the code and copy it manually.'); } }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy code'}</button></div><pre><code>{code}</code></pre><p>The live demo also supplies English labels. See <a href="/docs/#labels">localization</a> for the complete setup.</p></Tabs.Content>
    <div className="demo-status"><span aria-live="polite">{status}</span><span>Your files stay in your browser.</span></div>
  </Tabs.Root>;
}
