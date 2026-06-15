# KanadShield

Security intelligence network and packet capture analytics system.

## Phase 1 — Foundation

- Backend API: FastAPI (Python 3.11)
- Frontend: React (Vite + Tailwind CSS v4)
- Database: PostgreSQL (asyncpg)
- Ingestion: Elasticsearch
- Cache: Redis

## Run the system

```bash
docker compose up --build
```

## Future Enhancements (Out of Hackathon Scope)

The following features were deliberately deferred due to time constraints. The system's architecture is fully designed to accommodate all of them:

- **TCP Session Reconstruction**: Full Wireshark-style stream reassembly using Scapy's `TCPSession` tracker. Requires stateful packet buffering.
- **Integration with Cyber Crime Branch Systems**: RESTful adapter layer designed but not deployed due to no access to production CC branch APIs. Schema and endpoints ready.
- **Multi-Language Forensic Reports**: WeasyPrint PDF template supports i18n via Jinja2 template variables. Gujarati/Hindi report templates planned.
- **Kafka Streaming**: Production-ready Kafka clustering integrated for high-throughput streaming (active on `live-alerts` and `live-packets` topics).
- **Cloud Deployment**: Platform-agnostic Docker Compose configurations are cloud-ready. Kubernetes Helm charts in `k8s/` directory for GKE/EKS deployment.
- **SIEM Integration**: Elasticsearch index formats are Elastic Common Schema (ECS) compatible, enabling direct ingest into any ECS-compliant SIEM (Elastic SIEM, Splunk ES).
