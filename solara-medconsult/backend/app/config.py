from pydantic_settings import BaseSettings, SettingsConfigDict

#: Nome-mãe visual do produto (o repositório e os identificadores continuam medconsult).
NOME_MAE = "espec·IA·lidades"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql://medconsult:medconsult@127.0.0.1:5432/medconsult"
    redis_url: str = "redis://127.0.0.1:6379/0"

    # Armazenamento de objetos compativel com S3 (SeaweedFS no docker-compose)
    s3_endpoint: str = "127.0.0.1:8333"
    # Endereco que o NAVEGADOR enxerga (URLs assinadas). Vazio = igual a s3_endpoint.
    # Necessario quando o backend roda em container (s3_endpoint=storage:8333).
    s3_public_endpoint: str = ""
    s3_access_key: str = "medconsult"
    s3_secret_key: str = "medconsult-dev-secret"
    s3_bucket: str = "medconsult"

    deepgram_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Fase 2 — captura
    deepgram_model: str = "nova-3"
    deepgram_language: str = "pt-BR"
    openai_vision_model: str = "gpt-4o-mini"
    max_image_bytes: int = 10 * 1024 * 1024  # 10 MB
    max_audio_chunk_bytes: int = 256 * 1024

    # Fase 3 — RAG (embeddings OpenAI + pgvector). Trocar de modelo/dimensão exige reindexar.
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    # Especialidade ativa (conteúdo clínico). Veja app/especialidades/. Env: ESPECIALIDADE.
    especialidade: str = "dermatologia"
    # Acervo e diretrizes já indexados na nuvem da OpenAI (vector stores). Vazio = pgvector local.
    # Valem só para a especialidade ativa; se a nuvem falhar, cai no acervo local, com aviso.
    openai_rag_vector_store_id: str = ""
    openai_diretrizes_vector_store_id: str = ""
    rag_nuvem_score_min: float = 0.55
    rag_candidatos: int = 60  # trechos por busca (vetor/texto) antes de fundir/reordenar
    rag_consulta_max_chars: int = 2000
    # Reordenação por IA dos melhores candidatos (medido: leva o acerto ao 1º lugar na maioria).
    rag_rerank_model: str = "gpt-4o-mini"
    rag_rerank_candidatos: int = 40
    # Sugestão de diagnósticos (Fase 3): modelo de linguagem que lê o caso e o contexto do RAG.
    diagnostico_model: str = "gpt-4o-mini"
    diagnostico_max: int = 5
    diagnostico_trechos: int = 12  # trechos do acervo no contexto do modelo
    # Sugestão de tratamento (Fase 3): itens vindos de AI, RAG (livros) e Diretrizes.
    tratamento_model: str = "gpt-4o-mini"
    tratamento_max: int = 12
    tratamento_trechos: int = 12
    diretriz_max_chars: int = 10000
    # Busca web (fonte "Web"): ferramenta web_search da OpenAI, só nestes domínios.
    web_search_model: str = "gpt-4.1"  # o filtro de domínios não vale no gpt-4o-mini
    # None = usa os domínios da especialidade ativa; lista (mesmo vazia) tem precedência.
    web_search_domains: list[str] | None = None
    web_search_timeout: float = 90.0
    # História clínica gerada a partir do registro da Captura.
    historia_model: str = "gpt-4o-mini"
    # Pendências da anamnese (tela 3, Captura): o que falta e sinais de alarme não verificados.
    anamnese_pendencias_model: str = "gpt-4o-mini"
    # Trechos pequenos: um parágrafo colado a outros assuntos dilui o vetor (medido: 0,72 -> 0,51).
    rag_trecho_max_chars: int = 600
    rag_trecho_sobreposicao: int = 80

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


settings = Settings()
