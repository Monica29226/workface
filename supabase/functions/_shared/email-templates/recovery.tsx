/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { main, container, header, headerTitle, headerSubtitle, card, h1, text, button, footer } from './_styles.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Restablezca su contraseña de {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>ACL Workforce HUB</Heading>
          <Text style={headerSubtitle}>Sistema de Gestión de Planillas</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Restablecer contraseña</Heading>
          <Text style={text}>
            Recibimos una solicitud para restablecer su contraseña en {siteName}.
            Haga clic en el botón para elegir una nueva.
          </Text>
          <Button style={button} href={confirmationUrl}>Restablecer contraseña</Button>
          <Text style={footer}>
            Si no solicitó este cambio, puede ignorar este correo; su contraseña no será modificada.<br />
            © {new Date().getFullYear()} ACL Workforce HUB
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
