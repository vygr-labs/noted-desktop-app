export const globalCss = {
  extend: {
    '*': {
      '--global-color-border': 'colors.border',
      '--global-color-placeholder': 'colors.fg.subtle',
      '--global-color-selection': 'colors.colorPalette.subtle.bg',
      '--global-color-focus-ring': 'colors.colorPalette.solid.bg',
      boxSizing: 'border-box',
    },
    html: {
      colorPalette: 'indigo',
      fontFamily: 'body',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    body: {
      background: 'canvas',
      color: 'fg.default',
    },
    '::selection': {
      bg: 'indigo.a3',
      color: 'fg.default',
    },
    '::-webkit-scrollbar': {
      width: '6px',
      height: '6px',
    },
    '::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '::-webkit-scrollbar-thumb': {
      background: '{colors.gray.a4}',
      borderRadius: '3px',
      _hover: {
        background: '{colors.gray.a5}',
      },
    },
    // TipTap editor styles
    '.tiptap': {
      '& > * + *': {
        marginTop: '0.75em',
      },
      '& h1': {
        fontSize: '1.75rem',
        fontWeight: '700',
        lineHeight: '1.3',
        letterSpacing: '-0.025em',
        color: 'fg.default',
        mt: '1.5em',
        mb: '0.5em',
        '&:first-child': { mt: 0 },
      },
      '& h2': {
        fontSize: '1.35rem',
        fontWeight: '650',
        lineHeight: '1.35',
        letterSpacing: '-0.02em',
        color: 'fg.default',
        mt: '1.4em',
        mb: '0.4em',
      },
      '& h3': {
        fontSize: '1.1rem',
        fontWeight: '600',
        lineHeight: '1.45',
        letterSpacing: '-0.01em',
        color: 'fg.default',
        mt: '1.2em',
        mb: '0.3em',
      },
      '& p': {
        lineHeight: '1.6',
        fontSize: '0.9375rem',
        color: 'fg.default',
        letterSpacing: '-0.005em',
      },
      '& ul, & ol': {
        paddingLeft: '1.5em',
        fontSize: '0.9375rem',
      },
      '& ul': {
        listStyleType: 'disc',
      },
      '& ol': {
        listStyleType: 'decimal',
      },
      '& li': {
        lineHeight: '1.6',
        '& > p': {
          margin: 0,
        },
      },
      '& blockquote': {
        borderLeft: '3px solid',
        borderColor: 'indigo.6',
        paddingLeft: '1.25em',
        color: 'fg.muted',
        fontStyle: 'italic',
        my: '1.25em',
      },
      '& table': {
        borderCollapse: 'collapse',
        width: '100%',
        my: '1em',
        overflow: 'hidden',
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'gray.a3',
        fontSize: '0.875rem',
      },
      '& table th': {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'gray.a3',
        px: '3',
        py: '2',
        textAlign: 'left',
        verticalAlign: 'top',
        minWidth: '80px',
        position: 'relative',
        bg: 'gray.a2',
        fontWeight: '600',
        fontSize: '0.8125rem',
        color: 'fg.default',
      },
      '& table td': {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'gray.a3',
        px: '3',
        py: '2',
        textAlign: 'left',
        verticalAlign: 'top',
        minWidth: '80px',
        position: 'relative',
        color: 'fg.default',
      },
      '& table th > p': {
        margin: 0,
      },
      '& table td > p': {
        margin: 0,
      },
      '& table .selectedCell': {
        bg: 'indigo.a2',
      },
      '& code': {
        bg: 'gray.a3',
        borderRadius: '5px',
        px: '0.4em',
        py: '0.15em',
        fontSize: '0.85em',
        fontFamily: 'mono',
        color: 'indigo.11',
      },
      '& pre': {
        position: 'relative',
        bg: '{colors.gray.2}',
        borderRadius: '10px',
        p: '5',
        overflow: 'auto',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'gray.a3',
        '& code': {
          bg: 'transparent',
          p: 0,
          fontSize: '0.85em',
          color: 'fg.default',
        },
        '& .codeblock-copy-btn': {
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: 'gray.a4',
          bg: 'gray.a2',
          color: 'fg.subtle',
          cursor: 'pointer',
          opacity: 0,
          transition: 'opacity 0.15s, color 0.15s, background 0.15s',
          zIndex: 1,
        },
        _hover: {
          '& .codeblock-copy-btn': {
            opacity: 1,
          },
        },
        '& .codeblock-copy-btn:hover': {
          bg: 'gray.a3',
          color: 'fg.default',
        },
        '& .codeblock-copy-btn.copied': {
          opacity: 1,
          color: 'green.9',
        },
      },
      '& hr': {
        border: 'none',
        borderTop: '1px solid',
        borderTopColor: 'gray.a3',
        my: '2em',
      },
      '& strong': {
        fontWeight: '650',
      },
      '& em': {
        fontStyle: 'italic',
      },
      '& u': {
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
        textDecorationColor: '{colors.indigo.a5}',
      },
      '& s': {
        textDecoration: 'line-through',
        textDecorationColor: '{colors.gray.a6}',
      },
      '& mark': {
        bg: '{colors.yellow.a3}',
        borderRadius: '3px',
        px: '3px',
        py: '1px',
      },
      // Search highlights
      '& .search-match': {
        background: '{colors.indigo.a5}',
        borderRadius: '2px',
        px: '1px',
      },
      '& .search-current': {
        background: '{colors.indigo.9}',
        color: 'white',
        borderRadius: '2px',
        px: '1px',
      },
      // Task list styles
      '& ul[data-type="taskList"]': {
        listStyle: 'none',
        paddingLeft: 0,
        '& li': {
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6em',
          '& > label': {
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            height: 'calc(0.9375rem * 1.8)',
            '& input[type="checkbox"]': {
              cursor: 'pointer',
              accentColor: 'var(--colors-indigo-9)',
              width: '16px',
              height: '16px',
              margin: 0,
            },
          },
          '& > div': {
            flex: 1,
          },
        },
        '& li[data-checked="true"]': {
          '& > div > p': {
            textDecoration: 'line-through',
            color: 'fg.muted',
          },
        },
      },
    },
  },
}
