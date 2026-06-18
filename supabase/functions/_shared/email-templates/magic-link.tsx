/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { main, container, header, headerTitle, headerSubtitle, card, h1, text, button, footer } from './_styles.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Su enlace de acceso a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>ACL Web · Planillas</Heading>
          <Text style={headerSubtitle}>Portal institucional de nomina y autoservicio</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Su enlace de acceso</Heading>
          <Text style={text}>
            Haga clic en el botón para iniciar sesión en {siteName}. Este enlace expirará pronto.
          </Text>
          <Button style={button} href={confirmationUrl}>Iniciar sesión</Button>
          <Text style={footer}>
            Si no solicitó este enlace, puede ignorar este correo.<br />
            © {new Date().getFullYear()} ACL Web · Planillas
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
