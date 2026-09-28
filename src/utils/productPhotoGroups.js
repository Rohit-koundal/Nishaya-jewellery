// Explicit view suffixes only. IMG_001/002 and colour/design differences are
// never considered evidence that two photos show the same sellable product.
export function suggestPhotoGroups(files) {
  const groups = [];
  files.forEach((file, index) => {
    const path = String(file.webkitRelativePath || '').split('/');
    const folder = path.length > 2 ? path.slice(1, -1).join('/') : '';
    const stem = file.name.replace(/\.[^.]+$/, '');
    const match = stem.match(/^(.{2,80}?)[_ -]+(?:front|back|side|detail|closeup|close-up|cover|view[_ -]?\d+)$/i);
    const reference = folder || match?.[1] || '';
    const signal = folder ? 'folder' : match ? 'filename reference' : 'unmatched photo';
    const key = reference ? `${signal}:${reference.toLowerCase()}` : `photo:${index}`;
    let group = groups.find(value => value.key === key && value.fileIndexes.length < 12);
    if (!group) { group = { id: `group-${index}`, key, reference, signal, fileIndexes: [] }; groups.push(group); }
    group.fileIndexes.push(index);
  });
  return groups;
}

export function movePhoto(groups, photoIndex, targetId) {
  const target = groups.find(group => group.id === targetId);
  if (!target || target.fileIndexes.length >= 12 || target.fileIndexes.includes(photoIndex)) return groups;
  return groups.map(group => ({ ...group, fileIndexes: group.id === targetId ? [...group.fileIndexes, photoIndex] : group.fileIndexes.filter(index => index !== photoIndex) })).filter(group => group.fileIndexes.length);
}
export function splitPhoto(groups, photoIndex) {
  return [...groups.map(group => ({ ...group, fileIndexes: group.fileIndexes.filter(index => index !== photoIndex) })).filter(group => group.fileIndexes.length),
    { id: `split-${photoIndex}-${Date.now()}`, reference: '', signal: 'manually separated', fileIndexes: [photoIndex] }];
}
export function mergePhotoGroups(groups, fromId, toId) {
  const from = groups.find(group => group.id === fromId); const to = groups.find(group => group.id === toId);
  if (!from || !to || fromId === toId || from.fileIndexes.length + to.fileIndexes.length > 12) return groups;
  return groups.filter(group => group.id !== fromId).map(group => group.id === toId ? { ...group, fileIndexes: [...group.fileIndexes, ...from.fileIndexes], signal: 'manually merged' } : group);
}
