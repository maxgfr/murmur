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
  localOption: string;
  localOptionHint: string;
  localActive: string;
  orKey: string;
  useKey: string;
  localConsent: string;
  localDownload: string;
  localLoading: string;
  localLoadingLabel: string;
  localPreparing: string;
  localNoWebGPU: string;
  localLoadFailed: string;
  gigabytes: string;
  megabytes: string;
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
    "Pick how this site answers you: a model that runs in your browser, or your own AI key, kept encrypted in your browser and sent only to the provider you pick.",
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
  localOption: "Run a model in this browser",
  localOptionHint:
    "{name}, about {size} downloaded once, then kept in this browser. Needs WebGPU; nothing you type leaves your device.",
  localActive: "Running in this browser",
  orKey: "or connect a provider with your key",
  useKey: "Use an API key instead",
  localConsent:
    "This assistant can run entirely in your browser with {name}, an AI model of about {size}. It downloads once, then stays in this browser; your questions never leave your device.",
  localDownload: "Download and answer",
  localLoading: "Downloading the model…",
  localLoadingLabel: "Model download",
  localPreparing: "Preparing the model on your GPU…",
  localNoWebGPU:
    "This browser cannot run the model locally (no WebGPU). Try a recent Chrome, Edge or Safari, or use an API key.",
  localLoadFailed: "The model could not be loaded in this browser.",
  gigabytes: "GB",
  megabytes: "MB",
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
    "Choisissez comment ce site vous répond : un modèle qui tourne dans votre navigateur, ou votre propre clé d'IA, gardée chiffrée dans votre navigateur et envoyée seulement au fournisseur choisi.",
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
  localOption: "Faire tourner un modèle dans ce navigateur",
  localOptionHint:
    "{name}, environ {size} téléchargés une fois puis gardés dans ce navigateur. Nécessite WebGPU ; rien de ce que vous tapez ne quitte votre appareil.",
  localActive: "Modèle actif dans ce navigateur",
  orKey: "ou connectez un fournisseur avec votre clé",
  useKey: "Utiliser une clé API à la place",
  localConsent:
    "Cet assistant peut fonctionner entièrement dans votre navigateur avec {name}, un modèle d'IA d'environ {size}. Il se télécharge une fois puis reste dans ce navigateur ; vos questions ne quittent jamais votre appareil.",
  localDownload: "Télécharger et répondre",
  localLoading: "Téléchargement du modèle…",
  localLoadingLabel: "Téléchargement du modèle",
  localPreparing: "Préparation du modèle sur votre GPU…",
  localNoWebGPU:
    "Ce navigateur ne peut pas faire tourner le modèle en local (pas de WebGPU). Essayez un Chrome, Edge ou Safari récent, ou utilisez une clé API.",
  localLoadFailed: "Le modèle n'a pas pu être chargé dans ce navigateur.",
  gigabytes: "Go",
  megabytes: "Mo",
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
