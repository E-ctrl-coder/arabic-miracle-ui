export default function buckwalterToArabic(text) {
  if (!text) return '';
  const map = {
    'A': 'ا', 'b': 'ب', 't': 'ت', 'v': 'ث',
    'j': 'ج', 'H': 'ح', 'x': 'خ', 'd': 'د',
    'V': 'ذ', 'r': 'ر', 'z': 'ز', 's': 'س',
    '$': 'ش', 'S': 'ص', 'D': 'ض', 'T': 'ط',
    'Z': 'ظ', 'E': 'ع', 'g': 'غ', 'f': 'ف',
    'q': 'ق', 'k': 'ك', 'l': 'ل', 'm': 'م',
    'n': 'ن', 'h': 'ه', 'w': 'و', 'y': 'ي',
    'Y': 'ى', 'p': 'ة', "'": 'ء', '}': 'ئ',
    '{': 'أ', '|': 'آ', '*': 'ٱ'
  };

  // Remove symbols and Latin vowels not used in Buckwalter
  const cleaned = text.replace(/[@\^]/g, '').replace(/[aiuo]/g, '');

  return cleaned.split('').map(ch => map[ch] || ch).join('');
}
