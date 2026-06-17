/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { main, container, header, headerTitle, headerSubtitle, card, h1, text, codeStyle, footer } from './_styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Su código de verificación</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>ACL Workforce HUB</Heading>
          <Text style={headerSubtitle}>Sistema de Gestión de Planillas</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirme su identidad</Heading>
          <Text style={text}>Use el siguiente código para confirmar su identidad:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Este código expira pronto. Si no solicitó esto, ignore este correo.<br />
            © {new Date().getFullYear()} ACL Workforce HUB
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
