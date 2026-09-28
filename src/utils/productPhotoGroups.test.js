import { suggestPhotoGroups, movePhoto, splitPhoto, mergePhotoGroups } from './productPhotoGroups';
const photo = (name, folder = '') => ({ name, webkitRelativePath: folder ? `${folder}/${name}` : '' });
test('explicit product references group views but never merge different colours or numeric camera filenames', () => {
  const groups = suggestPhotoGroups([photo('E100_gold_front.jpg'), photo('E100_gold_side.jpg'), photo('E100_silver_front.jpg'), photo('IMG_001.jpg'), photo('IMG_002.jpg')]);
  expect(groups.map(group => group.fileIndexes)).toEqual([[0, 1], [2], [3], [4]]);
});
test('product subfolders assist grouping while a shared root alone is not enough evidence', () => {
  expect(suggestPhotoGroups([photo('a.jpg', 'supplier/E100'), photo('b.jpg', 'supplier/E100'), photo('c.jpg', 'supplier/E101')]).map(group => group.fileIndexes)).toEqual([[0, 1], [2]]);
  expect(suggestPhotoGroups([photo('a.jpg', 'supplier'), photo('b.jpg', 'supplier')])).toHaveLength(2);
});
test('moving, splitting and merging preserve every photo exactly once', () => {
  let groups = suggestPhotoGroups([photo('E100_front.jpg'), photo('E100_side.jpg'), photo('E200_front.jpg')]);
  groups = movePhoto(groups, 1, groups[1].id);
  expect(groups.map(group => group.fileIndexes)).toEqual([[0], [2, 1]]);
  groups = splitPhoto(groups, 1); expect(groups).toHaveLength(3);
  groups = mergePhotoGroups(groups, groups[2].id, groups[0].id);
  expect(groups.map(group => group.fileIndexes)).toEqual([[0, 1], [2]]);
  expect(groups.flatMap(group => group.fileIndexes).sort()).toEqual([0, 1, 2]);
});
test('grouping never exceeds the existing 12 views per product limit', () => {
  const groups = suggestPhotoGroups(Array.from({ length: 14 }, (_, index) => photo(`E100_view${index}.jpg`)));
  expect(groups.map(group => group.fileIndexes.length)).toEqual([12, 2]);
  expect(mergePhotoGroups(groups, groups[1].id, groups[0].id)).toBe(groups);
});
