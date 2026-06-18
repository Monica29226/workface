/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { main, container, header, headerTitle, headerSubtitle, card, h1, text, button, link, footer } from './_styles.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Ha sido invitado a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>ACL Web · Planillas</Heading>
          <Text style={headerSubtitle}>Portal institucional de nomina y autoservicio</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Le han invitado</Heading>
          <Text style={text}>
            Su empresa lo ha invitado a unirse a{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
            Haga clic en el botón para aceptar la invitación y crear su cuenta.
          </Text>
          <Button style={button} href={confirmationUrl}>Aceptar invitación</Button>
          <Text style={footer}>
            Si no esperaba esta invitación, puede ignorar este correo.<br />
            © {new Date().getFullYear()} ACL Web · Planillas
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
