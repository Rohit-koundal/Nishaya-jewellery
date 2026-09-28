import { useEffect, useMemo } from 'react';
import { mergePhotoGroups, movePhoto, splitPhoto } from '../../utils/productPhotoGroups';

export default function ProductPhotoGroups({ files, groups, onChange, disabled }) {
  const previews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);
  return <div className="draft-photo-groups">
    <p>Suggested groups use product-reference filenames (for example E123_front / E123_side) or product subfolders. Unmatched photos stay separate. Check groups below; uploading confirms them. Similar-looking items and variants are never merged by appearance.</p>
    {groups.map((group, groupIndex) => <section key={group.id} className="draft-photo-group">
      <div className="draft-smart-actions"><strong>Product {groupIndex + 1}</strong><span>{group.signal} · {group.fileIndexes.length}/12 photos</span><label>Supplier reference<input disabled={disabled} value={group.reference} maxLength={100} onChange={event => { const reference = event.target.value; onChange(groups.map(item => item.id === group.id ? { ...item, reference } : item)); }} /></label>
        <select aria-label={`Merge product ${groupIndex + 1}`} disabled={disabled} value="" onChange={event => onChange(mergePhotoGroups(groups, group.id, event.target.value))}><option value="">Merge into...</option>{groups.filter(item => item.id !== group.id && item.fileIndexes.length + group.fileIndexes.length <= 12).map(item => <option key={item.id} value={item.id}>Product {groups.indexOf(item) + 1}</option>)}</select>
      </div>
      <div className="draft-group-photos">{group.fileIndexes.map((index, position) => <figure key={index}>
        <img src={previews[index]} alt={files[index].name} /><figcaption>{files[index].name}</figcaption>
        <button type="button" disabled={disabled || position === 0} onClick={() => onChange(groups.map(item => item.id === group.id ? { ...item, fileIndexes: [index, ...item.fileIndexes.filter(value => value !== index)] } : item))}>{position === 0 ? 'Cover photo' : 'Make cover'}</button>
        <select aria-label={`Move ${files[index].name}`} value={group.id} disabled={disabled} onChange={event => onChange(movePhoto(groups, index, event.target.value))}>{groups.map((item, itemIndex) => <option key={item.id} value={item.id} disabled={item.id !== group.id && item.fileIndexes.length >= 12}>Product {itemIndex + 1}</option>)}</select>
        {group.fileIndexes.length > 1 && <button type="button" disabled={disabled} onClick={() => onChange(splitPhoto(groups, index))}>Separate product</button>}
      </figure>)}</div>
    </section>)}
  </div>;
}
