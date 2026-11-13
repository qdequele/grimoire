// Portraits of the pre-generated investigators: drawn by OpenAI's image model as 1920s sepia studio
// photographs, then turned into the small square JPEG an investigator's photo is (192 px, ≤ 60,000
// characters as a data URL) and shipped as files in ./portraits/<id>.jpg.
// `node scripts/pregen-portraits.mjs` (OPENAI_API_KEY) makes them.
// No imports: the script reads this file with Node's type stripping.

/** What each portrait shows, by pregen id (English: QuiverAI's prompts). */
export const PORTRAIT_SUBJECTS: Record<string, string> = {
  'eleanor-whitcomb':
    'a young woman newspaper reporter in her late twenties, short bobbed hair under a cloche hat with a press card tucked in its band, belted trench coat with the collar up, sharp curious eyes, a pencil behind her ear',
  'isaiah-freeman':
    'a Black man in his mid thirties, a writer and former soldier, neat short hair and a full, neatly trimmed moustache, round wire spectacles, a tweed waistcoat over a white shirt with rolled sleeves, a calm determined look',
  'harlan-moss':
    'a heavy-set private detective in his late forties, broad face with a broken nose and stubble, a battered fedora pulled low, a rumpled overcoat over a loosened tie, a cigarette at the corner of his mouth',
  'ruth-abernathy':
    'a woman doctor in her late thirties, hair pinned up severely, a stethoscope around her neck over a dark high-collared dress, a white coat, tired but piercing eyes, faint lines of worry',
  'grace-liang':
    'a Chinese-American woman physician in her mid thirties, sleek dark hair in a low bun, a high-necked silk blouse under a doctor’s white coat, holding a small glass vial up to the light, attentive and composed',
  'silas-crane':
    'an elderly professor in his late fifties, gaunt face, untidy white hair and a short grey beard, pince-nez spectacles, a worn tweed jacket with elbow patches over a waistcoat and watch chain, an old leather-bound book held to his chest',
  'esperanza-vidal':
    'a Mexican woman archaeologist in her mid forties, sun-weathered face, dark hair with a streak of grey tied back under a wide-brimmed field hat, a khaki field shirt with a scarf knotted at the neck, a confident steady gaze',
  'theodore-van-ness':
    'a handsome young man in his mid twenties from old New York money, slicked-back hair, a leather aviator jacket with a fur collar over a dinner shirt and loosened bow tie, flying goggles pushed up on his forehead, a reckless grin',
  'josephine-baptiste':
    'a Creole woman novelist in her early thirties, dark curly hair under a silk head wrap, large hoop earrings, a beaded evening shawl, a fountain pen in her hand, knowing dark eyes and the hint of a smile',
  'frank-mallory':
    'an Irish-American police detective sergeant in his early forties, square jaw, red-brown hair going grey at the temples, a bowler hat, a heavy wool overcoat with a police badge pinned inside the lapel, a hard skeptical stare',
  'clayton-rhodes':
    'a weathered Texan lawman around fifty, deep sun lines, a thick grey moustache, a wide Stetson hat, a sheepskin-lined canvas jacket over a vest with a star-shaped badge, narrowed pale eyes',
  'adelaide-prentiss':
    'a dignified elderly woman antiquarian in her early sixties, silver hair in a neat chignon, a high lace collar with a cameo brooch, a jeweller’s loupe on a ribbon around her neck, shrewd kindly eyes',
}

/** One shared look, so the twelve read as a set: an old sepia studio photograph from a family album. */
export const portraitPrompt = (subject: string): string =>
  `A 1920s American studio portrait photograph of ${subject}. Head and shoulders, three-quarter view, the face centred in the upper middle of a square frame so it stays whole when cropped to a circle. Sepia-toned silver gelatin print, soft light from a tall window on one side, gentle shadows, shallow depth of field, a plain mottled painted studio backdrop, fine film grain, slightly faded like a print kept in an old family album. A photograph of a real-looking person, not a painting or a drawing. No text, no caption, no frame, no border, no watermark.`
