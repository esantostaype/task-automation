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
        neutral: {
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
        root: ({ ownerState }) => ({
          backgroundColor: 'var(--soft-bg)',
          border: '1px solid transparent',
          borderRadius: '0.5rem',
          fontFamily: 'inherit',
          fontWeight: '400',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },

          '&:focus-within': {
            backgroundColor: 'var(--soft-bg-active)',
            outline: '1px solid var(--color-accent-500)',
          },

          '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
            backgroundColor: 'var(--soft-bg)',
          },
          ...(ownerState.size === 'sm' && {
            fontSize: '0.875rem',
            padding: '0 0.75rem',
            height: '2.25rem',
            borderRadius: '0.375rem',
            '&::placeholder': {
              fontSize: '0.875rem',
              color: 'var(--color-gray-400)'
            },
            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none'
            }
          }),
          ...(ownerState.size === 'md' && {
            fontSize: '1rem',
            padding: '0 1rem',
            height: '3rem',
            borderRadius: '0.5rem',

            '&::placeholder': {
              fontSize: '1rem',
              color: 'var(--color-gray-400)'
            },

            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none'
            }
          }),
          ...(ownerState.size === 'lg' && {
            fontSize: '1.125rem',
            padding: '0 1.25rem',
            height: '3.5rem',
            borderRadius: '0.625rem',

            '&::placeholder': {
              fontSize: '1.125rem',
              color: 'var(--color-gray-400)',
            },

            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none',
            }
          })
        }),
      },
    },
    JoySelect: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          backgroundColor: 'var(--soft-bg)',
          border: '1px solid transparent',
          borderRadius: '0.5rem',
          fontFamily: 'inherit',
          fontWeight: '400',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },

          '&:focus-within': {
            backgroundColor: 'var(--soft-bg-active)',
            outline: '1px solid var(--color-accent-500)',
          },

          '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
            backgroundColor: 'var(--soft-bg)',
          },
          ...(ownerState.size === 'sm' && {
            fontSize: '0.875rem',
            padding: '0 0.75rem',
            height: '2.25rem',
            borderRadius: '0.375rem',
            '&::placeholder': {
              fontSize: '0.875rem',
              color: 'var(--color-gray-400)'
            },
            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none'
            }
          }),
          ...(ownerState.size === 'md' && {
            fontSize: '1rem',
            padding: '0 1rem',
            height: '3rem',
            borderRadius: '0.5rem',

            '&::placeholder': {
              fontSize: '1rem',
              color: 'var(--color-gray-400)'
            },

            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none'
            }
          }),
          ...(ownerState.size === 'lg' && {
            fontSize: '1.125rem',
            padding: '0 1.25rem',
            height: '3.5rem',
            borderRadius: '0.625rem',

            '&::placeholder': {
              fontSize: '1.125rem',
              color: 'var(--color-gray-400)',
            },

            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none',
            }
          })
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
          padding: '0.8rem 1rem',
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
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--soft-bg)',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },
          ...(ownerState.checked && {
            backgroundColor: 'var(--color-accent-500)',
            '&:hover': {
              backgroundColor: 'var(--color-accent-600)',
            },
            color: 'black'
          })
        })
      }
    },
    JoyButton: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.size === 'sm' && {
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            height: '2.25rem',
          }),

          ...(ownerState.size === 'md' && {
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            height: '3rem',
          }),

          ...(ownerState.size === 'lg' && {
            padding: '1rem 1.25rem',
            fontSize: '1.125rem',
            height: '3.5rem',
          }),

          ...(ownerState.variant === 'solid' && {
            fontWeight: '400',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'transparent',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
            '&:disabled': {
              backgroundColor: 'var(--soft-bg)',
              color: 'rgba(255,255,255,0.3)'
            },
          }),

          ...(ownerState.variant === 'outlined' && {
            fontWeight: '400',
            borderWidth: '1px',
            borderStyle: 'solid',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'var(--soft-bg-success-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--soft-bg-success-active)',
            },
          }),

          ...(ownerState.variant === 'soft' && {
            fontWeight: '400',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'transparent',
            backgroundColor: 'var(--soft-bg-success)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'var(--soft-bg-success-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--soft-bg-success-active)',
            },
          }),

          ...(ownerState.variant === 'plain' && {
            fontWeight: '400',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'var(--soft-bg)',
            },
            '&:active': {
              backgroundColor: 'var(--soft-bg-hover)',
            },
          })
        }),
      },
    },
    JoyIconButton: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.size === 'sm' && {
            padding: '0.5rem',
            fontSize: '0.875rem',
            height: '2.25rem',
            width: '2.25rem'
          }),

          ...(ownerState.size === 'md' && {
            padding: '0.75rem',
            fontSize: '1rem',
            height: '3rem',
            width: '3rem'
          }),

          ...(ownerState.size === 'lg' && {
            padding: '1rem',
            fontSize: '1.125rem',
            height: '3.5rem',
            width: '3.5rem'
          }),

          ...(ownerState.variant === 'solid' && {
            fontWeight: '600',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          }),

          ...(ownerState.variant === 'outlined' && {
            fontWeight: '400',
            borderWidth: '1px',
            borderStyle: 'solid',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'var(--soft-bg-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--soft-bg-active)',
            },
          }),

          ...(ownerState.variant === 'soft' && {
            fontWeight: '400',
            backgroundColor: 'var(--soft-bg-success)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'var(--soft-bg-success-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--soft-bg-success-active)',
            },
          }),

          ...(ownerState.variant === 'plain' && {
            fontWeight: '400',
            backgroundColor: 'transparent',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'var(--soft-bg-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--soft-bg-active)',
            },
          }),
          ...(ownerState.size === 'sm' && ownerState.variant === 'solid' && {
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          }),

          ...(ownerState.size === 'lg' && ownerState.variant === 'outlined' && {
            borderWidth: '2px',
          }),

          ...(ownerState.size === 'md' && ownerState.variant === 'soft' && {
          }),

          '@media (max-width: 768px)': {
            ...(ownerState.size === 'lg' && {
              padding: '0.8rem 1.2rem',
              fontSize: '1rem',
            }),
          },
        }),
      },
    },
    JoyChip: {
      styleOverrides: {
        root: () => ({
          borderRadius: '0.25rem',
          padding: '0.2rem 0.4rem',
        }),
      },
    },
    JoyFormLabel: {
      styleOverrides: {
        root: () => ({
          fontWeight: '400',
          fontSize: '0.75rem',
          color: 'var(--color-gray-400)',
          marginBottom: '0.4rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          alignItems: 'center',
          gap: '0.25rem',
          display: 'flex',
        }),
      },
    },
    JoyAutocomplete: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          backgroundColor: 'var(--soft-bg)',
          border: '1px solid transparent',
          borderRadius: '0.5rem',
          fontFamily: 'inherit',
          fontWeight: '400',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },

          '&:focus-within': {
            backgroundColor: 'var(--soft-bg-active)',
            outline: '1px solid var(--color-accent-500)',
          },

          '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
            backgroundColor: 'var(--soft-bg)',
          },
          ...(ownerState.size === 'sm' && {
            fontSize: '0.875rem',
            padding: '0 0.75rem',
            height: '2.25rem',
            borderRadius: '0.375rem',
            '&::placeholder': {
              fontSize: '0.875rem',
              color: 'var(--color-gray-400)'
            },
            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none'
            }
          }),
          ...(ownerState.size === 'md' && {
            fontSize: '1rem',
            padding: '0 1rem',
            height: '3rem',
            borderRadius: '0.5rem',

            '&::placeholder': {
              fontSize: '1rem',
              color: 'var(--color-gray-400)'
            },

            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none'
            }
          }),
          ...(ownerState.size === 'lg' && {
            fontSize: '1.125rem',
            padding: '0 1.25rem',
            height: '3.5rem',
            borderRadius: '0.625rem',

            '&::placeholder': {
              fontSize: '1.125rem',
              color: 'var(--color-gray-400)',
            },

            '&:focus-within': {
              backgroundColor: 'var(--soft-bg-active)',
              outline: 'none',
            }
          })
        }),
        listbox: {
          fontSize: '1rem',
          backgroundColor: 'var(--surface)',
          boxShadow: 'none',
          border: 'none',
        },
        option: {
          '&&:hover': {
            backgroundColor: 'var(--soft-bg-hover)',
          },
          '&&:active': {
            backgroundColor: 'var(--soft-bg-active)',
          },
          '&&[aria-selected="true"]': {
            backgroundColor: 'var(--soft-bg-success)',
          },
        }
      }
    }
  }
})