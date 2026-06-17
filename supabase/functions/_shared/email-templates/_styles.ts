// Shared brand styling for ACL Workforce HUB auth emails
export const brand = {
  navy: '#0F2A44',
  gold: '#C9A24D',
  text: '#475569',
  heading: '#0F2A44',
  muted: '#94a3b8',
  border: '#e2e8f0',
  surface: '#f8fafc',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  margin: 0,
  padding: 0,
}
export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
export const header = {
  background: brand.navy,
  padding: '28px 24px',
  borderRadius: '10px 10px 0 0',
  textAlign: 'center' as const,
}
export const headerTitle = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 600 as const,
  margin: 0,
  letterSpacing: '0.3px',
}
export const headerSubtitle = {
  color: 'rgba(255,255,255,0.75)',
  fontSize: '12px',
  margin: '6px 0 0',
}
export const card = {
  border: `1px solid ${brand.border}`,
  borderTop: 'none',
  borderRadius: '0 0 10px 10px',
  padding: '32px 28px',
  background: '#ffffff',
}
export const h1 = {
  fontSize: '22px',
  fontWeight: 600 as const,
  color: brand.heading,
  margin: '0 0 16px',
}
export const text = {
  fontSize: '15px',
  color: brand.text,
  lineHeight: '1.6',
  margin: '0 0 20px',
}
export const button = {
  backgroundColor: brand.navy,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  borderBottom: `3px solid ${brand.gold}`,
}
export const link = { color: brand.navy, textDecoration: 'underline' }
export const footer = {
  fontSize: '12px',
  color: brand.muted,
  margin: '32px 0 0',
  borderTop: `1px solid ${brand.border}`,
  paddingTop: '16px',
  textAlign: 'center' as const,
}
export const codeStyle = {
  fontFamily: 'Menlo, Courier, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  color: brand.navy,
  letterSpacing: '6px',
  background: brand.surface,
  border: `1px solid ${brand.border}`,
  borderRadius: '8px',
  padding: '16px 20px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}
