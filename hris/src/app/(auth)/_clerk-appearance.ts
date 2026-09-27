/**
 * Shared Clerk <SignIn /> / <SignUp /> appearance for the TRACE HRMS
 * auth pages. Keeps the two flows visually identical.
 */

const brand = '#2C5282';

export const clerkAppearance = {
  variables: {
    colorPrimary: brand,
    colorText: '#1a202c',
    colorTextSecondary: '#4a5568',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#1a202c',
    borderRadius: '12px',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '15px',
  },
  elements: {
    rootBox: {
      width: '100%',
      maxWidth: 460,
    },
    card: {
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(14px)',
      border: '1px solid rgba(44, 82, 130, 0.12)',
      borderRadius: '20px',
      boxShadow:
        '0 30px 60px rgba(44, 82, 130, 0.16), 0 8px 20px rgba(0, 0, 0, 0.04)',
      padding: '32px',
    },
    headerTitle: {
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      fontSize: '26px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#1a202c',
    },
    headerSubtitle: {
      fontSize: '14px',
      color: '#4a5568',
    },
    socialButtonsBlockButton: {
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      borderRadius: '10px',
      fontWeight: 600,
      transition: 'all 0.2s ease',
    },
    socialButtonsBlockButton__hover: {
      borderColor: '#3182ce',
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 14px rgba(44, 82, 130, 0.14)',
    },
    formFieldInput: {
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      padding: '11px 14px',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },
    formFieldInput__focus: {
      borderColor: brand,
      boxShadow: '0 0 0 3px rgba(44, 82, 130, 0.15)',
    },
    formButtonPrimary: {
      background: `linear-gradient(135deg, ${brand} 0%, #3182ce 100%)`,
      borderRadius: '10px',
      padding: '11px 16px',
      fontWeight: 600,
      letterSpacing: '0.01em',
      boxShadow: '0 8px 18px rgba(44, 82, 130, 0.28)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    },
    formButtonPrimary__hover: {
      transform: 'translateY(-1px)',
      boxShadow: '0 12px 24px rgba(44, 82, 130, 0.34)',
    },
    footer: {
      background: 'transparent',
    },
    footerActionText: {
      color: '#4a5568',
    },
    footerActionLink: {
      color: brand,
      fontWeight: 600,
    },
    dividerLine: { background: '#e2e8f0' },
    dividerText: { color: '#718096' },
  },
} as const;
