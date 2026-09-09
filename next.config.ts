import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Las fotos de carnet del onboarding y los PDF de contratos firmados
    // (escaneados, a veces de varias páginas) superan el límite por defecto
    // (1MB) de los Server Actions. Si se supera este límite, Next.js no
    // rechaza la request con un error claro: corta el body a mitad del
    // multipart y termina tirando "Unexpected end of form".
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // src/proxy.ts corre en casi todas las rutas (matcher excluye solo
    // api/_next/*), incluida la página de detalle de personal donde se
    // hace el POST del Server Action para subir el contrato. Next.js
    // clona y bufferea el body de esa request para que el proxy pueda
    // leerlo, con un límite propio (10MB por defecto) que es independiente
    // de serverActions.bodySizeLimit y lo corta primero. Tiene que ser al
    // menos tan grande como ese límite para que no trunque el upload.
    proxyClientMaxBodySize: "25mb",
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Service-Worker-Allowed", value: "/" }],
      },
    ];
  },
};

export default nextConfig;
