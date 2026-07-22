// Minimal fr/en dictionary. French default. Every user-facing string lives here.
// A fuller catalogue + the document-output-language axis come later. No em-dashes.

export type Locale = 'fr' | 'en';
export const DEFAULT_LOCALE: Locale = 'fr';

const M = {
  fr: {
    app_name: 'Wouri',
    tagline: 'Un seul dossier par expedition, du bon de commande jusqu au reglement.',
    login: 'Se connecter',
    signup: 'Creer un compte',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    org_name: 'Nom de votre entreprise',
    org_slug: 'Identifiant court (ex: bakossi-cocoa)',
    create_org: 'Creer mon espace',
    home: 'Accueil',
    signout: 'Se deconnecter',
    your_org: 'Votre entreprise',
    capabilities: 'Ce que vous faites',
    cap_hint: 'Choisissez vos activites. Vous pourrez en ajouter plus tard.',
    no_account: 'Pas encore de compte',
    have_account: 'Deja un compte',
    enabled: 'Active',
    enable: 'Activer',
    disable: 'Desactiver',
    forgot_password: 'Mot de passe oublie',
    forgot_title: 'Reinitialiser votre mot de passe',
    forgot_send: 'Envoyer le lien',
    forgot_sent: 'Si un compte existe, un e-mail vient de partir. Verifiez votre boite.',
    magic_link: 'Recevoir un lien magique',
    magic_sent: 'Si un compte existe, un lien de connexion vient de partir.',
    reset_title: 'Choisissez un nouveau mot de passe',
    new_password: 'Nouveau mot de passe',
    reset_save: 'Enregistrer',
  },
  en: {
    app_name: 'Wouri',
    tagline: 'One file per shipment, from the purchase order to settlement.',
    login: 'Sign in',
    signup: 'Create an account',
    email: 'Email address',
    password: 'Password',
    org_name: 'Your company name',
    org_slug: 'Short handle (e.g. bakossi-cocoa)',
    create_org: 'Create my workspace',
    home: 'Home',
    signout: 'Sign out',
    your_org: 'Your company',
    capabilities: 'What you do',
    cap_hint: 'Pick your activities. You can add more later.',
    no_account: 'No account yet',
    have_account: 'Already have an account',
    enabled: 'Enabled',
    enable: 'Enable',
    disable: 'Disable',
    forgot_password: 'Forgot password',
    forgot_title: 'Reset your password',
    forgot_send: 'Send the link',
    forgot_sent: 'If an account exists, an email is on its way. Check your inbox.',
    magic_link: 'Email me a magic link',
    magic_sent: 'If an account exists, a sign-in link is on its way.',
    reset_title: 'Choose a new password',
    new_password: 'New password',
    reset_save: 'Save',
  },
} as const;

export type Key = keyof (typeof M)['fr'];
export function t(key: Key, locale: Locale = DEFAULT_LOCALE): string {
  return M[locale][key] ?? M.fr[key] ?? String(key);
}
