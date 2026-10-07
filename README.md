# ⚖️ Legal Vault

### Judicial Intelligence • Evidence Integrity • Blockchain Verification • AI-Powered Legal Research

**Legal Vault** is a secure, role-based judicial intelligence platform designed to bring **legal evidence management, case collaboration, document integrity, blockchain verification, auditability, and AI-powered legal research** into a unified digital ecosystem.

The platform is designed around one core principle:

> **Legal evidence should be securely stored, traceable throughout its lifecycle, independently verifiable, and intelligently searchable.**

Legal Vault connects **citizens, lawyers, judges, and administrators** through a controlled judicial workflow while combining conventional legal information systems with modern technologies such as **AI/RAG, vector search, blockchain anchoring, cryptographic document hashing, and role-based access control.**

---

## 🚀 Why Legal Vault?

Legal workflows often involve multiple disconnected systems:

- Case information
- Legal documents
- Evidence
- Lawyers and clients
- Judicial review
- Document verification
- Legal research
- Audit records
- Evidence integrity

This fragmentation can make it difficult to answer critical questions:

- **Who uploaded this document?**
- **Has the document changed since submission?**
- **Which case does this evidence belong to?**
- **Who is authorized to access it?**
- **When was it submitted or verified?**
- **Can the integrity of the evidence be independently established?**
- **Can relevant legal authorities be discovered quickly?**
- **Can judges, lawyers, and clients work from the same trusted case record?**

Legal Vault brings these workflows together into a single platform.

---

# 🎯 Core Objectives

Legal Vault is built around six major objectives:

### 1. Evidence Integrity

Create a verifiable chain of custody for important legal documents and evidence.

### 2. Secure Case Management

Provide role-aware access to cases, documents, evidence, and judicial workflows.

### 3. Blockchain-Based Verification

Anchor document integrity information on-chain so that document hashes can be independently verified.

### 4. AI-Powered Legal Intelligence

Provide contextual legal research and AI assistance using a grounded legal knowledge base and retrieval-augmented generation.

### 5. Complete Auditability

Maintain structured records of important actions throughout the legal workflow.

### 6. Role-Based Judicial Collaboration

Provide specialized workflows for:

- Citizens
- Lawyers
- Judges
- Administrators

---

# 🏛️ Platform Architecture

```text
                         ┌──────────────────────────┐
                         │       Legal Vault        │
                         │   Judicial Intelligence  │
                         └────────────┬─────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 │                    │                    │
                 ▼                    ▼                    ▼
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │   Frontend     │   │   Backend API  │   │  Blockchain    │
        │ React + Vite   │   │ Express + TS   │   │   Ethereum     │
        └───────┬────────┘   └───────┬────────┘   └───────┬────────┘
                │                    │                    │
                │                    │                    │
                ▼                    ▼                    ▼
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │ Role-Based UI  │   │ PostgreSQL     │   │ LegalVault.sol │
        │                │   │ + Prisma       │   │                │
        └────────────────┘   └───────┬────────┘   └────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
                ┌────────────────┐       ┌────────────────────┐
                │ Case / Evidence│       │ AI / RAG Engine    │
                │ / Audit Data   │       │ Legal Knowledge    │
                └────────────────┘       │ + Vector Search    │
                                         └────────────────────┘
```

---

# 👥 Role-Based Architecture

Legal Vault uses a role-based architecture to ensure that every participant interacts with the platform according to their responsibilities.

## 👤 Citizen / Client

Citizens can:

- Access their cases
- View case information
- Upload permitted documents/evidence
- Review submitted documents
- Interact with case-related AI assistance
- Track their legal workflow

The frontend maps the client role to the backend `CITIZEN` role.

---

## ⚖️ Lawyer

Lawyers have access to professional legal workflows including:

- Case management
- Client/case workspace
- Document management
- Evidence handling
- Evidence integrity workflows
- Blockchain anchoring
- Legal research
- AI-powered legal assistance

The lawyer workflow is designed to provide a consolidated workspace for preparing and managing legal matters.

---

## 👨‍⚖️ Judge

Judges receive a specialized judicial workflow for:

- Assigned cases
- Case documents
- Evidence review
- Document integrity verification
- Blockchain verification
- Judicial verification workflows
- AI-assisted legal research
- Legal authority discovery

Judge access is governed by case assignment and authorization rules.

---

## 🛡️ Administrator

Administrators provide platform-level management capabilities including:

- User management
- Case administration
- Judge assignment
- Authorized blockchain anchor management
- Platform-level controls

Administrative functionality is isolated from normal participant workflows.

---

# 📂 Evidence Lifecycle

Legal Vault models evidence as a lifecycle rather than simply a file upload.

```text
        Upload
          │
          ▼
   ┌─────────────┐
   │  Document   │
   │  Submitted  │
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ Case-linked │
   │  Evidence   │
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ Hash /      │
   │ Integrity   │
   │ Generation  │
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ Blockchain  │
   │   Anchor    │
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ Independent │
   │ Verification│
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │ Judicial /  │
   │ Legal Review│
   └─────────────┘
```

This architecture allows the system to separate:

- Document storage
- Document identity
- Case association
- Integrity verification
- Blockchain anchoring
- Judicial verification

---

# 🔐 Evidence Integrity

One of the central concepts behind Legal Vault is **document integrity**.

Instead of treating a document as merely a stored file, the platform associates important evidence with integrity information that can be used during verification.

A simplified integrity workflow is:

```text
Original Document
       │
       ▼
Cryptographic Hash
       │
       ▼
Case / Evidence Record
       │
       ▼
Blockchain Anchor
       │
       ▼
Later Verification
       │
       ▼
Hash Comparison
       │
       ├── Match ───────► Integrity Maintained
       │
       └── Mismatch ────► Document Changed
```

This creates a technical mechanism for detecting changes to anchored documents.

---

# ⛓️ Blockchain Evidence Anchoring

Legal Vault integrates Ethereum-based blockchain infrastructure for document integrity anchoring.

The smart contract is implemented in:

```text
smart-contracts/contracts/LegalVault.sol
```

The contract provides functionality for:

- Document anchoring
- Authorized anchor management
- Integrity-related blockchain records
- Event-based blockchain traceability

### Authorization Model

Blockchain anchoring is not treated as an unrestricted operation.

Legal Vault uses an authorized-anchor model:

```text
Administrator
     │
     ▼
Authorized Anchor
     │
     ▼
Anchor Document
     │
     ▼
Ethereum Network
```

This provides an additional authorization layer between application users and blockchain state changes.

---

# 🧠 AI-Powered Legal Intelligence

Legal Vault incorporates an AI service architecture designed specifically around legal workflows.

The AI layer supports configurable providers:

```text
AI_PROVIDER
   │
   ├── mock
   │
   ├── openai
   │
   └── gemini
```

This provider abstraction allows the application to switch AI backends without tightly coupling the rest of the platform to one provider.

---

# 🔎 Retrieval-Augmented Legal Research

Legal Vault uses a Retrieval-Augmented Generation architecture for legal research.

```text
                User Question
                      │
                      ▼
              ┌───────────────┐
              │ Query Analysis│
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Legal Retrieval│
              └───────┬───────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   Legal Knowledge Base     Vector Retrieval
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
              Relevant Authorities
                      │
                      ▼
                AI Generation
                      │
                      ▼
             Grounded Response
```

The project contains dedicated services for:

- Legal knowledge retrieval
- Legal authority chunks
- Precedent/knowledge ingestion
- Vector-based retrieval
- AI provider abstraction
- Legal research APIs

The backend also includes a `LegalAuthorityChunk` data model for structured legal knowledge.

---

# 📚 Legal Knowledge Base

The legal intelligence layer includes infrastructure for maintaining and importing legal knowledge.

The repository contains dedicated knowledge-base services and CLI utilities for legal corpus ingestion.

This allows the platform to evolve from a static AI assistant into a **domain-grounded legal intelligence system**.

The intended architecture is:

```text
Legal Sources
     │
     ▼
Ingestion
     │
     ▼
Chunking / Processing
     │
     ▼
Legal Authority Records
     │
     ▼
Embeddings / Vector Store
     │
     ▼
Retrieval
     │
     ▼
AI Legal Research
```

---

# 🧾 Auditability

Legal Vault maintains structured audit information as part of the platform's data model.

The database includes an audit log model alongside:

- Users
- Cases
- Participants
- Documents
- Evidence
- Blockchain transactions
- Verification records
- Document comparisons

This allows important actions to be represented as structured records instead of relying only on application logs.

---

# 🗄️ Data Architecture

Legal Vault uses:

**PostgreSQL + Prisma ORM**

The core data model includes:

```text
User
 │
 ├── Cases
 │
 ├── Documents
 │
 ├── Evidence
 │
 ├── Audit Logs
 │
 └── Verification Records

Case
 │
 ├── Participants
 │
 ├── Documents
 │
 ├── Evidence
 │
 ├── Assigned Judge
 │
 └── Document Comparisons

Document
 │
 ├── Case
 │
 ├── Evidence
 │
 ├── Blockchain Transaction
 │
 └── Verification Record

LegalAuthorityChunk
 │
 └── Legal AI / RAG
```

---

# 🔒 Security Architecture

Security is implemented across multiple layers.

## Authentication

The application uses authenticated sessions/tokens and an authoritative backend `/auth/me` endpoint for role hydration.

---

## Authorization

Backend roles include:

```text
CITIZEN
LAWYER
JUDGE
ADMIN
```

Authorization is enforced at the API/service layer rather than relying exclusively on frontend visibility.

---

## Case Isolation

Case and document access is scoped according to the authenticated user's relationship with the case.

This provides an important separation between:

```text
User A
   │
   └── Authorized Cases

User B
   │
   └── Different Authorized Cases
```

rather than exposing all case records to authenticated users.

---

## Role-Gated Operations

Sensitive operations are protected by role-specific authorization.

Examples include:

| Operation | Authorized Role |
|---|---|
| Client case access | Citizen / participant |
| Lawyer case workflows | Lawyer |
| Evidence upload | Citizen / Lawyer |
| Blockchain anchoring | Lawyer / authorized anchor |
| Blockchain verification | Judge |
| Judge assignment | Admin |
| Authorized anchor management | Admin |
| Judicial verification | Judge |

---

# 🧩 Technology Stack

## Frontend

- React
- TypeScript
- Vite
- React Router
- Context-based authentication
- Role-based UI architecture
- Modular workspace components

---

## Backend

- Node.js
- Express
- TypeScript
- REST API
- Authentication middleware
- Authorization middleware
- Validation layer
- Service-oriented backend architecture

---

## Database

- PostgreSQL
- Prisma ORM
- Prisma migrations
- Seed infrastructure

---

## Blockchain

- Solidity
- Ethereum
- Hardhat
- Ethers
- Smart-contract based document anchoring
- Authorized blockchain anchors

---

## AI / RAG

- Configurable AI provider architecture
- OpenAI support
- Gemini support
- Mock provider for development
- Retrieval-Augmented Generation
- Legal knowledge base
- Vector retrieval architecture
- Legal authority chunks

---

## Testing

The project contains testing infrastructure across multiple layers:

```text
Frontend
   │
   └── Utility / component-related tests

Backend
   │
   └── API / service tests

Smart Contracts
   │
   └── Hardhat contract tests
```

---

# 📁 Project Structure

```text
LegalVault/
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   ├── workspace/
│   │   └── copilot/
│   │
│   ├── contexts/
│   ├── pages/
│   │   ├── public/
│   │   └── app/
│   │
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       │   └── ai/
│       │       ├── legal/
│       │       └── vector/
│       ├── validators/
│       ├── app.ts
│       └── server.ts
│
├── smart-contracts/
│   ├── contracts/
│   │   └── LegalVault.sol
│   ├── scripts/
│   ├── test/
│   └── hardhat.config.ts
│
├── DEPLOYMENT.md
├── README_DEPLOYMENT.md
├── package.json
└── .env.example
```

---

# 🔌 API Architecture

The backend exposes its API under:

```text
/api/v1
```

Major API domains include:

```text
/api/v1/auth
/api/v1/users
/api/v1/cases
/api/v1/documents
/api/v1/blockchain
/api/v1/ai
/api/v1/legal
```

This domain-oriented structure keeps authentication, case management, evidence, blockchain, and legal intelligence separated at the API layer.

---

# 🧑‍💻 Development Setup

## Prerequisites

Install:

- Node.js
- npm
- PostgreSQL
- Git
- A supported Ethereum development/network environment if blockchain functionality is required
- Appropriate AI provider credentials if using external AI services

---

## Clone the Repository

```bash
git clone <your-repository-url>

cd LegalVault
```

---

# 📦 Install Dependencies

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install smart-contract dependencies:

```bash
cd ../smart-contracts
npm install
```

---

# ⚙️ Environment Configuration

The project provides environment templates:

```text
.env.example
backend/.env.example
smart-contracts/.env.example
```

Typical backend configuration includes:

```env
DATABASE_URL=
DIRECT_URL=

JWT_SECRET=

AI_PROVIDER=
AI_MODEL=
OPENAI_API_KEY=
GEMINI_API_KEY=

VECTOR_STORE=

BLOCKCHAIN_RPC_URL=
BLOCKCHAIN_PRIVATE_KEY=
BLOCKCHAIN_CONTRACT_ADDRESS=
BLOCKCHAIN_CHAIN_ID=
```

Use the environment variables appropriate for the services you intend to run.

**Never commit real secrets, private keys, API keys, or production credentials to Git.**

---

# 🗃️ Database Setup

From the backend directory:

```bash
npx prisma generate
```

Apply migrations:

```bash
npx prisma migrate deploy
```

For development environments where migrations are being actively developed:

```bash
npx prisma migrate dev
```

---

# 🌱 Seed Demo Data

The project includes an upsert-based Prisma seed.

```bash
npx prisma db seed
```

The seed provides demo users and a demonstration case.

---

# 🧪 Running the Application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend from the project root:

```bash
npm run dev
```

The Vite development server will provide the frontend URL.

---

# 🧪 Testing

Frontend tests:

```bash
npm test
```

Backend tests:

```bash
cd backend
npm test
```

Smart-contract tests:

```bash
cd smart-contracts
npx hardhat test
```

Type checking and production builds should be run before deployment.

---

# ⛓️ Smart Contract Development

The smart contract is located at:

```text
smart-contracts/contracts/LegalVault.sol
```

The Hardhat project includes:

```text
contracts/
scripts/
test/
hardhat.config.ts
```

Deployment scripts are provided under:

```text
smart-contracts/scripts/
```

A deployed contract address should be configured in the backend environment so the application can communicate with the deployed contract.

---

# 🤖 AI Provider Configuration

Legal Vault supports multiple AI modes.

### Mock

Useful for local development:

```env
AI_PROVIDER=mock
```

### OpenAI

```env
AI_PROVIDER=openai
```

### Gemini

```env
AI_PROVIDER=gemini
```

The provider abstraction allows the application to maintain the same application-level AI interface while changing the underlying model provider.

---

# 🔎 Legal Research Workflow

A typical legal research interaction follows:

```text
Lawyer / Judge
      │
      ▼
Legal Research Interface
      │
      ▼
Natural Language Query
      │
      ▼
Legal Retrieval Layer
      │
      ▼
Relevant Legal Authorities
      │
      ▼
AI Context Construction
      │
      ▼
Generated Legal Research Response
```

The architecture is designed to prioritize grounded legal information rather than treating the AI model as an isolated general-purpose chatbot.

---

# 🧠 AI Copilot

The platform includes AI/coplanar workspace components designed to bring intelligent assistance closer to the legal workflow.

Potential use cases include:

- Legal research
- Case understanding
- Document analysis
- Evidence-related assistance
- Finding relevant authorities
- Contextual case questions

The architecture keeps AI functionality behind backend services so that provider credentials and retrieval logic are not exposed directly to the browser.

---

# 🏛️ Judicial Workflow

Legal Vault is designed around a structured judicial workflow:

```text
Citizen
   │
   │ submits documents/evidence
   ▼
Case
   │
   ▼
Lawyer
   │
   │ prepares / manages evidence
   ▼
Blockchain Integrity Layer
   │
   ▼
Judge
   │
   ├── Reviews Case
   ├── Reviews Documents
   ├── Verifies Integrity
   ├── Performs Judicial Verification
   └── Uses Legal Research
   │
   ▼
Auditable Judicial Record
```

---

# 🔗 Trust Model

Legal Vault combines multiple trust mechanisms rather than relying on a single technology.

```text
                LEGAL VAULT TRUST MODEL

                     ┌──────────────┐
                     │ Authentication│
                     └───────┬──────┘
                             │
                     ┌───────▼──────┐
                     │ Authorization│
                     └───────┬──────┘
                             │
                ┌────────────▼────────────┐
                │       Case Access       │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │    Evidence Integrity   │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Blockchain Verification │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │      Auditability       │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │      AI / RAG           │
                │  Legal Intelligence     │
                └─────────────────────────┘
```

The goal is not simply to digitize legal documents.

The goal is to establish a **trusted digital evidence ecosystem**.

---

# 🌐 Deployment Architecture

A production deployment can be structured as:

```text
                        Internet
                           │
                           ▼
                    ┌─────────────┐
                    │  Frontend   │
                    │ React / Vite│
                    └──────┬──────┘
                           │ HTTPS
                           ▼
                    ┌─────────────┐
                    │ Backend API │
                    │ Node/Express│
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        PostgreSQL      AI / RAG     Blockchain
        + Prisma        Services      Ethereum
             │             │             │
             └─────────────┴─────────────┘
                           │
                           ▼
                    Audit / Evidence
                       Ecosystem
```

Deployment documentation is provided in:

```text
DEPLOYMENT.md
README_DEPLOYMENT.md
```

---

# 📊 Key Platform Capabilities

| Capability | Legal Vault |
|---|:---:|
| Role-based authentication | ✅ |
| Citizen workflow | ✅ |
| Lawyer workflow | ✅ |
| Judge workflow | ✅ |
| Admin workflow | ✅ |
| Case management | ✅ |
| Document management | ✅ |
| Evidence management | ✅ |
| Evidence integrity | ✅ |
| Blockchain anchoring | ✅ |
| Blockchain verification | ✅ |
| Audit records | ✅ |
| Legal research | ✅ |
| RAG architecture | ✅ |
| Legal knowledge base | ✅ |
| Vector retrieval architecture | ✅ |
| Configurable AI providers | ✅ |
| PostgreSQL persistence | ✅ |
| Prisma ORM | ✅ |
| Smart contracts | ✅ |
| Automated testing infrastructure | ✅ |

---

# 💡 What Makes Legal Vault Different?

Legal Vault is not designed as:

> "an AI chatbot for lawyers"

and it is not simply:

> "a blockchain document storage application."

Instead, it combines the two with a broader judicial information architecture.

### Traditional Legal Platform

```text
Cases
+
Documents
+
Users
```

### Legal Vault

```text
Cases
+
Documents
+
Evidence
+
Role-Based Access
+
Auditability
+
Cryptographic Integrity
+
Blockchain Verification
+
Legal Knowledge Retrieval
+
AI Assistance
```

This combination creates a foundation for a **trust-aware legal intelligence platform**.

---

# 🏆 Innovation Areas

## 1. Evidence + Blockchain

Instead of using blockchain as a generic database, Legal Vault applies blockchain specifically to the **integrity verification layer**.

---

## 2. AI + Legal Knowledge

The AI layer is designed around retrieval from a legal knowledge base rather than relying exclusively on model-generated knowledge.

---

## 3. Role-Aware Intelligence

Different participants can interact with different parts of the legal workflow while the backend remains the authorization authority.

---

## 4. Evidence-Centric Architecture

Documents are treated as part of a broader evidence lifecycle involving:

- Case association
- Access control
- Integrity
- Verification
- Auditability

---

## 5. Unified Judicial Workflow

Citizens, lawyers, judges, and administrators are represented within the same platform while maintaining role-specific permissions.

---

# 🔮 Future Scope

Legal Vault provides a foundation that can be extended toward a larger legal technology ecosystem.

Potential future directions include:

- Expanded Indian legal corpus ingestion
- Larger precedent databases
- Advanced semantic legal search
- Multilingual legal research
- Indian-language legal AI
- Court workflow integrations
- Advanced evidence-chain visualization
- Digital signatures
- Advanced document comparison
- Court filing integrations
- Legal timeline generation
- Case outcome analytics
- Explainable AI research results
- Advanced vector infrastructure
- Production-grade cloud deployment
- Institutional judicial integrations

---

# ⚠️ Responsible AI

Legal Vault is intended as a **legal technology and decision-support platform**.

AI-generated information should be treated as assistance rather than a substitute for:

- Professional legal judgment
- Judicial decision-making
- Official legal sources
- Court records
- Qualified legal advice

Legal research outputs should be validated against authoritative sources before being relied upon in real legal proceedings.

---

# 🧑‍💻 Development Philosophy

Legal Vault follows several architectural principles:

### Security First

Authorization belongs at the backend and service layer.

### Evidence First

Documents are treated as legal artifacts rather than ordinary uploads.

### Grounded AI

AI should operate with relevant legal context whenever possible.

### Modular Architecture

Frontend, backend, database, AI, and blockchain responsibilities remain separated.

### Auditability

Important operations should be traceable.

### Least Privilege

Users should receive only the access required for their role and case relationships.

### Extensibility

The platform is structured so that new AI providers, legal datasets, blockchain infrastructure, and integrations can be introduced without redesigning the entire system.

---

# 👨‍💻 Project

**Legal Vault**

### Judicial Intelligence • Evidence Integrity • Blockchain • AI

Built with:

```text
React
TypeScript
Node.js
Express
PostgreSQL
Prisma
Solidity
Hardhat
Ethereum
AI / RAG
Vector Search

