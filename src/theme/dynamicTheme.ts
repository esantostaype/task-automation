import { extendTheme } from '@mui/joy/styles'

declare module '@mui/joy/styles' {
  interface PalettePrimaryOverrides {
    950: true
  }

  interface PaletteNeutralOverrides {
    950: true
  }

  interface PaletteDangerOverrides {
    950: true
  }
}
export const dynamicTheme = extendTheme({
  colorSchemes: {
    dark: {
      palette: {
        primary: {
          50: "#F3F6FB",
          100: "#E3EBF6",
          200: "#BECCE3",
          300: "#A4B6D8",
          400: "#89A1CC",
          500: "#6F8CC0",
          600: "#5979A9",
          700: "#436692",
          800: "#2C547C",
          900: "#164165",
          950: "#002E4E"
        },
        danger: {
          50: "#fef2f2",
          100: "#ffe2e2",
          200: "#ffc9c9",
          300: "#ffa2a2",
          400: "#ff6467",
          500: "#fb2c36",
          600: "#e7000b",
          700: "#c10007",
          800: "#9f0712",
          900: "#82181a",
          950: "#460809",
        }
      },
    },
  },
  components: {
    JoyInput: {
      styleOverrides: {
        root: () => ({
          fontSize: '1rem',
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--soft-bg)',
          border: 'none',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)'
          },
          transition: 'background-color 0.1s ease-in-out'          
        }),
      },
    },
    JoySelect: {
      styleOverrides: {
        root: () => ({
          fontSize: '1rem',
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--soft-bg)',
          border: 'none',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)'
          },
          transition: 'background-color 0.1s ease-in-out',
        }),
        listbox: {
          fontSize: '1rem',
          backgroundColor: 'var(--surface)',
          boxShadow: 'none',
          border: 'none',
        }
      }
    },
    JoyOption: {
      styleOverrides: {
        root: () => ({
          '&&:hover': {
            backgroundColor: 'var(--soft-bg-hover)'
          },
          '&&:active': {
            backgroundColor: 'var(--soft-bg-active)'
          },
          '&&[aria-selected="true"]': {
            backgroundColor: 'var(--soft-bg-success)'
          }
        })
      }
    },
    JoyTextarea: {
      styleOverrides: {
        root: () => ({
          fontSize: '1rem',
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--soft-bg)',
          border: 'none',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)'
          },
          transition: 'background-color 0.1s ease-in-out'
        })
      }
    },
    JoyCheckbox: {
      styleOverrides: {
        checkbox: ({ ownerState }) => ({
          fontSize: '1rem',
          height: '1.5rem',
          width: '1.5rem',
          border: 'none',
          transition: 'background-color 0.1s ease-in-out',
          backgroundColor: 'var(--soft-bg)',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },
          ...(ownerState.checked && {
            backgroundColor: '',
            '&:hover': {
              backgroundColor: '',
            },
            color: 'black'
          })
        })
      }
    },
    JoyRadio: {
      styleOverrides: {
        radio: ({ ownerState }) => ({
          fontSize: '1rem',
          height: '1.5rem',
          width: '1.5rem',
          border: 'none',
          transition: 'background-color 0.1s ease-in-out',
          backgroundColor: 'var(--soft-bg)',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },
          ...(ownerState.checked && {
            backgroundColor: 'var(--accent-500)',
            '&:hover': {
              backgroundColor: 'var(--accent-600)',
            },
            color: 'black'
          })
        })
      }
    }
  }
})