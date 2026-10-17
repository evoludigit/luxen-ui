import type { LuxenTranslation } from '../shared/localize.js';

const en: LuxenTranslation = {
  $code: 'en',
  $name: 'English',
  $dir: 'ltr',

  loading: 'Loading',
  close: 'Close',

  previousSlide: 'Previous slide',
  nextSlide: 'Next slide',
  toggleFullscreen: 'Toggle fullscreen',
  goToSlide: (n) => `Go to slide ${n}`,

  showPassword: 'Show password',

  // data-table
  selectAllRows: 'Select all rows on this page',

  // column-manager
  shownColumns: 'Shown columns',
  hiddenColumns: 'Hidden columns',
  fixedColumns: 'Fixed columns',
  showColumn: (label) => `Show column ${label}`,
  hideColumn: (label) => `Hide column ${label}`,
  moveColumnUp: (label) => `Move ${label} up`,
  moveColumnDown: (label) => `Move ${label} down`,
  columnPosition: (label, position, total) => `${label}, position ${position} of ${total}`,
  columnShown: (label) => `${label} shown`,
  columnHidden: (label) => `${label} hidden`,
  resetColumns: 'Reset columns',
  columnsReset: 'Columns reset',
  dropColumnHere: 'Drop a column here',

  increaseValue: 'Increase value',
  decreaseValue: 'Decrease value',

  rangeMinimum: 'Minimum',
  rangeMaximum: 'Maximum',

  clear: 'Clear',
  noResults: 'No results',
  selectOption: 'Please select an option.',
  suggestions: 'Suggestions',
  search: 'Search',

  remove: 'Remove',

  richTextEditor: 'Rich text editor',
  formatting: 'Formatting',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  highlight: 'Highlight',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  blockquote: 'Blockquote',
  codeBlock: 'Code block',
  horizontalRule: 'Horizontal rule',
  link: 'Link',
  emoji: 'Emoji',
  attachFile: 'Attach file',
  undo: 'Undo',
  redo: 'Redo',

  stories: 'Stories',
  storyProgress: 'Story progress',
  previousStory: 'Previous story',
  nextStory: 'Next story',
  mute: 'Mute',
  unmute: 'Unmute',
};

export default en;
