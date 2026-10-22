# 0001 — SeaweedFS no lugar do MinIO

**Contexto.** O MinIO parou de distribuir imagens Docker em outubro de 2025 e o repositório foi
arquivado em 2026; `docker pull minio/minio` falha.

**Decisão.** Armazenar laudos e imagens em SeaweedFS (`chrislusf/seaweedfs`), acessado pela API S3.
O backend usa o cliente S3 padrão (`boto3`), sem código específico do servidor.

**Consequências.** Qualquer servidor compatível com S3 (SeaweedFS, AWS S3 etc.) funciona trocando
`S3_ENDPOINT` e as credenciais. A coluna `minio_object_name` da tabela `images` guarda o nome do
objeto e mantém o nome histórico; renomeá-la exige migração e não foi feito.
