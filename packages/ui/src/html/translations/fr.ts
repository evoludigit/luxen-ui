import { registerTranslation, type LuxenTranslation } from '../shared/localize.js';

const fr: LuxenTranslation = {
  $code: 'fr',
  $name: 'Français',
  $dir: 'ltr',

  loading: 'Chargement',
  close: 'Fermer',

  previousSlide: 'Diapositive précédente',
  nextSlide: 'Diapositive suivante',
  toggleFullscreen: 'Basculer en plein écran',
  goToSlide: (n) => `Aller à la diapositive ${n}`,

  showPassword: 'Afficher le mot de passe',

  // data-table
  selectAllRows: 'Sélectionner les lignes de la page',

  // column-manager
  shownColumns: 'Colonnes affichées',
  hiddenColumns: 'Colonnes masquées',
  fixedColumns: 'Colonnes figées',
  showColumn: (label) => `Afficher la colonne ${label}`,
  hideColumn: (label) => `Masquer la colonne ${label}`,
  moveColumnUp: (label) => `Monter ${label}`,
  moveColumnDown: (label) => `Descendre ${label}`,
  columnPosition: (label, position, total) => `${label}, position ${position} sur ${total}`,
  columnShown: (label) => `${label} affichée`,
  columnHidden: (label) => `${label} masquée`,
  resetColumns: 'Réinitialiser les colonnes',
  columnsReset: 'Colonnes réinitialisées',
  dropColumnHere: 'Glissez une colonne ici',

  increaseValue: 'Augmenter la valeur',
  decreaseValue: 'Diminuer la valeur',

  rangeMinimum: 'Minimum',
  rangeMaximum: 'Maximum',

  clear: 'Effacer',
  noResults: 'Aucun résultat',
  selectOption: 'Veuillez sélectionner une option.',
  suggestions: 'Suggestions',

  richTextEditor: 'Éditeur de texte enrichi',
  formatting: 'Mise en forme',
  heading1: 'Titre 1',
  heading2: 'Titre 2',
  heading3: 'Titre 3',
  bold: 'Gras',
  italic: 'Italique',
  underline: 'Souligné',
  strikethrough: 'Barré',
  highlight: 'Surligner',
  bulletList: 'Liste à puces',
  orderedList: 'Liste numérotée',
  blockquote: 'Citation',
  codeBlock: 'Bloc de code',
  horizontalRule: 'Trait horizontal',
  link: 'Lien',
  emoji: 'Émoji',
  attachFile: 'Joindre un fichier',
  undo: 'Annuler',
  redo: 'Rétablir',

  stories: 'Stories',
  storyProgress: 'Progression de la story',
  previousStory: 'Story précédente',
  nextStory: 'Story suivante',
  mute: 'Couper le son',
  unmute: 'Activer le son',
};

registerTranslation(fr);

export default fr;
