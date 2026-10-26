import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { ptPT } from "@clerk/localizations";
import { shadcn } from "@clerk/themes";
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import App from "./App";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#9b83ff",
    colorForeground: "#f2f2f4",
    colorMutedForeground: "#aaa5b3",
    colorDanger: "#f1a5a5",
    colorBackground: "#14131a",
    colorInput: "#100f14",
    colorInputForeground: "#f2f2f4",
    colorNeutral: "#302d38",
    fontFamily: "Manrope, sans-serif",
    borderRadius: "16px",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: { width: "440px", maxWidth: "100%", overflow: "hidden", borderRadius: "20px", backgroundColor: "#14131a", border: "1px solid #302d38" },
    card: { boxShadow: "none", border: "none", backgroundColor: "transparent" },
    footer: { boxShadow: "none", border: "none", backgroundColor: "transparent" },
    headerTitle: { color: "#f2f2f4", fontWeight: 700 },
    headerSubtitle: { color: "#aaa5b3" },
    socialButtonsBlockButtonText: { color: "#f2f2f4" },
    formFieldLabel: { color: "#ded9e4" },
    footerActionLink: { color: "#b6a4ff" },
    footerActionText: { color: "#aaa5b3" },
    dividerText: { color: "#aaa5b3" },
    formButtonPrimary: { backgroundColor: "#9b83ff", color: "#100f14" },
    formFieldInput: { backgroundColor: "#100f14", color: "#f2f2f4", borderColor: "#302d38" },
    alertText: { color: "#f1a5a5" },
  },
};

function AuthLoading() {
  return <main className="iris-auth-page" aria-live="polite">A preparar a autenticação…</main>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/workspace" /> : <App />;
}

function WorkspaceRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <App /> : <Redirect to="/" />;
}

function SignInRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (isSignedIn) return <Redirect to="/workspace" />;
  return (
    <main className="iris-auth-page">
      <a className="iris-auth-back" href={basePath || "/"}>Voltar à IRIS</a>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </main>
  );
}

function SignUpRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (isSignedIn) return <Redirect to="/workspace" />;
  return (
    <main className="iris-auth-page">
      <a className="iris-auth-back" href={basePath || "/"}>Voltar à IRIS</a>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </main>
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={ptPT}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/workspace" component={WorkspaceRoute} />
        <Route path="/sign-in/*?" component={SignInRoute} />
        <Route path="/sign-up/*?" component={SignUpRoute} />
        <Route component={HomeRoute} />
      </Switch>
    </ClerkProvider>
  );
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

export default function AuthRoutes() {
  if (!clerkPubKey) {
    throw new Error("A autenticação da IRIS não está configurada.");
  }
  return (
    <WouterRouter base={basePath}>
      <ClerkRoutes />
    </WouterRouter>
  );
}
