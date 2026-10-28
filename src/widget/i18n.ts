/** Every string the widget shows. Add a language by adding a dictionary to `MESSAGES`. */
export interface Messages {
  open: string;
  close: string;
  title: string;
  greeting: string;
  placeholder: string;
  send: string;
  stop: string;
  settings: string;
  back: string;
  sources: string;
  notFound: string;
  thinking: string;
  newChat: string;
  poweredBy: string;
  errorAuth: string;
  errorNetwork: string;
  errorRate: string;
  errorOther: string;
  retry: string;
  setupTitle: string;
  setupIntro: string;
  provider: string;
  model: string;
  apiKey: string;
  apiKeyHint: string;
  remember: string;
  local: string;
  localHint: string;
  endpoint: string;
  test: string;
  testing: string;
  testOk: string;
  testFail: string;
  save: string;
  forget: string;
  loadingCatalog: string;
  catalogError: string;
  searchModels: string;
  recommended: string;
  otherProviders: string;
}

const en: Messages = {
  open: "Ask a question",
  close: "Close",
  title: "Ask this site",
  greeting: "Hi! Ask me anything about this site. I answer from its pages and link to them.",
  placeholder: "Your question…",
  send: "Send",
  stop: "Stop",
  settings: "AI settings",
  back: "Back to chat",
  sources: "Sources",
  notFound: "Nothing on this site matched. Try other words?",
  thinking: "Looking through the site…",
  newChat: "New conversation",
  poweredBy: "Answers from this site's pages, by murmur",
  errorAuth: "The key was refused. Check it in the AI settings.",
  errorNetwork: "No answer from the AI provider: key refused or network down.",
  errorRate: "The AI provider is busy or rate-limited. Try again in a moment.",
  errorOther: "The answer failed:",
  retry: "Try again",
  setupTitle: "Connect an AI model",
  setupIntro:
    "This site lets you use your own AI key. It stays in your browser, encrypted, and is only sent to the provider you pick.",
  provider: "Provider",
  model: "Model",
  apiKey: "API key",
  apiKeyHint: "Sent only to the provider, never to this site.",
  remember: "Remember on this device",
  local: "Local server (Ollama, LM Studio)",
  localHint: "The server must allow this site's origin (CORS).",
  endpoint: "Server URL",
  test: "Test",
  testing: "Testing…",
  testOk: "Connected.",
  testFail: "Connection failed:",
  save: "Save and chat",
  forget: "Forget my key",
  loadingCatalog: "Loading models…",
  catalogError: "Could not load the model list.",
  searchModels: "Search models",
  recommended: "Recommended",
  otherProviders: "Other providers",
};

const fr: Messages = {
  open: "Poser une question",
  close: "Fermer",
  title: "Demandez au site",
  greeting:
    "Bonjour ! Posez-moi une question sur ce site. Je réponds à partir de ses pages, avec les liens.",
  placeholder: "Votre question…",
  send: "Envoyer",
  stop: "Arrêter",
  settings: "Réglages IA",
  back: "Retour au chat",
  sources: "Sources",
  notFound: "Rien sur ce site ne correspond. Essayez d'autres mots ?",
  thinking: "Je cherche dans le site…",
  newChat: "Nouvelle conversation",
  poweredBy: "Réponses tirées des pages de ce site, par murmur",
  errorAuth: "La clé a été refusée. Vérifiez-la dans les réglages IA.",
  errorNetwork: "Pas de réponse du fournisseur d'IA : clé refusée ou réseau coupé.",
  errorRate: "Le fournisseur d'IA est saturé ou limite les appels. Réessayez dans un instant.",
  errorOther: "La réponse a échoué :",
  retry: "Réessayer",
  setupTitle: "Connecter un modèle d'IA",
  setupIntro:
    "Ce site vous laisse utiliser votre propre clé d'IA. Elle reste dans votre navigateur, chiffrée, et n'est envoyée qu'au fournisseur choisi.",
  provider: "Fournisseur",
  model: "Modèle",
  apiKey: "Clé API",
  apiKeyHint: "Envoyée uniquement au fournisseur, jamais à ce site.",
  remember: "Mémoriser sur cet appareil",
  local: "Serveur local (Ollama, LM Studio)",
  localHint: "Le serveur doit autoriser l'origine de ce site (CORS).",
  endpoint: "URL du serveur",
  test: "Tester",
  testing: "Test…",
  testOk: "Connecté.",
  testFail: "Échec de la connexion :",
  save: "Enregistrer et discuter",
  forget: "Oublier ma clé",
  loadingCatalog: "Chargement des modèles…",
  catalogError: "Impossible de charger la liste des modèles.",
  searchModels: "Chercher un modèle",
  recommended: "Recommandés",
  otherProviders: "Autres fournisseurs",
};

export const MESSAGES: Record<string, Messages> = { en, fr };

/** The first supported language among the candidates (`fr-CA` matches `fr`), else English. */
export function pickLanguage(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const code = c?.toLowerCase().split(/[-_]/)[0];
    if (code && code in MESSAGES) return code;
  }
  return "en";
}

/** The dictionary of a language, with the owner's overrides on top. */
export function messagesFor(language: string, overrides: Partial<Messages> = {}): Messages {
  return { ...(MESSAGES[language] ?? en), ...overrides };
}
