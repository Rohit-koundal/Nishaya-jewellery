import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import ProductPhotoGroups from './ProductPhotoGroups';
import { suggestPhotoGroups } from '../../utils/productPhotoGroups';

export default function DraftPhotoUpload({ files, setFiles, uploading, onUpload, onClose }) {
  const [groups, setGroups] = useState([]);
  const [autoFill, setAutoFill] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setGroups(suggestPhotoGroups(files)); }, [files]);
  const choose = event => {
    const incoming = Array.from(event.target.files || []);
    if (incoming.length > 30) { setError('Choose up to 30 photos per batch. No files were replaced.'); return; }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { setError('Choose JPG, PNG or WEBP photos up to 2MB each. No files were replaced.'); return; }
    setError(''); setFiles(incoming);
  };
  return <section className="admin-card draft-upload-panel" aria-label="Create drafts from photos">
    {error && <p role="alert" className="draft-alert is-error">{error}</p>}
    <div className="draft-panel-heading"><div><p>PHOTO → DETAILS → REVIEW → PUBLISH</p><h2>Create drafts from product photos</h2><span>Up to 30 photos per batch, up to 12 views per product. Nothing goes live automatically.</span></div><button type="button" disabled={uploading} onClick={onClose} aria-label="Close upload panel"><X /></button></div>
    <div className="draft-upload-options"><label className="draft-dropzone"><strong>Choose product photos</strong><span>JPG, PNG or WEBP, up to 2MB each.</span><input type="file" multiple disabled={uploading} accept="image/jpeg,image/jpg,image/png,image/webp" onChange={choose} /></label><label className="draft-dropzone"><strong>Choose supplier folder</strong><span>Use a subfolder per product to suggest groups.</span><input type="file" multiple webkitdirectory="" disabled={uploading} accept="image/jpeg,image/jpg,image/png,image/webp" onChange={choose} /></label></div>
    {!!files.length && <><div className="draft-smart-actions"><button type="button" className="admin-btn-ghost" disabled={uploading || files.length > 12} onClick={() => setGroups([{ id: 'all', reference: '', signal: 'confirmed one product', fileIndexes: files.map((_, index) => index) }])}>All photos are one product</button><button type="button" className="admin-btn-ghost" disabled={uploading} onClick={() => setGroups(files.map((_, index) => ({ id: `single-${index}`, reference: '', signal: 'separate photo', fileIndexes: [index] })))}>One product per photo</button><button type="button" className="admin-btn-ghost" disabled={uploading} onClick={() => setGroups(suggestPhotoGroups(files))}>Suggest groups again</button></div><ProductPhotoGroups files={files} groups={groups} onChange={setGroups} disabled={uploading} /></>}
    <label className="draft-smart-copy"><input type="checkbox" checked={autoFill} disabled={uploading} onChange={event => setAutoFill(event.target.checked)} />Run Smart Fill automatically after upload (uses configured AI quota).</label>
    <div className="draft-upload-actions"><span>{files.length} photos · {groups.length} products</span><button type="button" className="admin-btn-ghost" disabled={uploading || !files.length} onClick={() => setFiles([])}>Clear</button><button type="button" className="admin-btn" disabled={uploading || !files.length || !groups.length} onClick={() => onUpload({ groups: groups.map(({ fileIndexes, reference }) => ({ fileIndexes, reference })), autoFill })}>{uploading ? 'Creating drafts...' : `Confirm groups & create ${groups.length} drafts`}</button></div>
  </section>;
}
