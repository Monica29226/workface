/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { main, container, header, headerTitle, headerSubtitle, card, h1, text, button, link, footer } from './_styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirme su correo para acceder a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>ACL Workforce HUB</Heading>
          <Text style={headerSubtitle}>Sistema de Gestión de Planillas</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirme su correo electrónico</Heading>
          <Text style={text}>
            Gracias por registrarse en{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
          </Text>
          <Text style={text}>
            Confirme su dirección{' '}<strong>{recipient}</strong> haciendo clic en el botón:
          </Text>
          <Button style={button} href={confirmationUrl}>Verificar correo</Button>
          <Text style={footer}>
            Si usted no creó esta cuenta, puede ignorar este mensaje.<br />
            © {new Date().getFullYear()} ACL Workforce HUB
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
