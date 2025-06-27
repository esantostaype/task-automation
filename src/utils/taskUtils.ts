const UX_UI_KEYWORDS = ['UX', 'UI', 'UX/UI', 'User Experience', 'User Interface', 'Diseño UX', 'Diseño UI']
const GRAPHIC_KEYWORDS = ['Graphic', 'Gráfico', 'Branding', 'Logo', 'Identidad', 'Print', 'Editorial']

export const getTypeKind = (typeName: string): 'UX/UI' | 'Graphic' | 'Unknown' => {
  const nameUpper = typeName.toUpperCase()
  if (UX_UI_KEYWORDS.some(keyword => nameUpper.includes(keyword.toUpperCase()))) {
    return 'UX/UI'
  }
  if (GRAPHIC_KEYWORDS.some(keyword => nameUpper.includes(keyword.toUpperCase()))) {
    return 'Graphic'
  }
  return 'Unknown'
}