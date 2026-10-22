import { create } from "zustand";

/**
 * Pré-visualizações das imagens da captura (URLs de objeto do navegador).
 * Ficam só na memória: não vão para o localStorage (blobs não são serializáveis
 * e estourariam a cota). Após recarregar a página, só os nomes permanecem.
 */
interface PreviewsState {
  urls: Record<string, string>;
  setPreview: (nome: string, url: string) => void;
  removePreview: (nome: string) => void;
  limparPreviews: () => void;
}

export const usePreviews = create<PreviewsState>()((set, get) => ({
  urls: {},
  setPreview: (nome, url) => set({ urls: { ...get().urls, [nome]: url } }),
  removePreview: (nome) => {
    const { urls } = get();
    const url = urls[nome];
    if (url) URL.revokeObjectURL(url);
    const resto = { ...urls };
    delete resto[nome];
    set({ urls: resto });
  },
  limparPreviews: () => {
    Object.values(get().urls).forEach((u) => URL.revokeObjectURL(u));
    set({ urls: {} });
  },
}));
