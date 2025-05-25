# KinChain Frontend

This directory contains the Next.js frontend for the KinChain application. KinChain is a system for verifying lineage and relationships using Zero-Knowledge Proofs (ZKPs) and blockchain technology. Users can register families and individuals, establish relationships, and generate ZKPs to prove these connections without revealing underlying sensitive data. These proofs can then be recorded on-chain.

## Project Overview

The KinChain platform consists of several key components:

- **Frontend (Next.js & TypeScript):** Provides the user interface for interacting with the system. Users can:
  - Register new families.
  - Register new individuals (relations) within families, optionally marking them as family heads.
  - View lineage information.
  - Generate ZK-proofs for specific relationships or full lineage.
  - Submit these proofs to the blockchain.
  - Validate proofs.
- **Backend (NestJS & TypeScript):** Handles business logic, data storage (PostgreSQL), and interaction with the ZK-SNARK service and Ethereum blockchain.
- **ZK-SNARK Service (Rust):** Generates the cryptographic proofs.
- **Ethereum Smart Contracts (Solidity):** Stores and verifies proof records on the blockchain.
- **Database (PostgreSQL):** Stores family and relation data.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js and npm/yarn/pnpm (for local development outside Docker)
- Access to an Ethereum development network (e.g., local Hardhat/Anvil node, or a testnet) and a deployed `ZKProofLog.sol` contract.

### Environment Variables

The application is configured using environment variables. You'll need to create a `.env` file in the root of the `kinChain` project (i.e., `/home/karlito/projects/hackathons/eth25/kinChain/.env`) before running the Docker containers.

**Required Environment Variables (for `.env` in the project root):**

```env
# PostgreSQL Configuration
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=kinchain_db
DB_HOST=postgres_db # Service name in docker-compose
DB_PORT=5432

# Backend Configuration
BACKEND_PORT=3001
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${POSTGRES_DB}
API_URL=http://localhost:3001 # Used by frontend to connect to backend

# Ethereum Node Configuration (for Backend)
ETH_NODE_URL=ws://your_ethereum_node_ws_url # e.g., ws://localhost:8545 or a testnet/mainnet WS provider
ETH_PRIVATE_KEY=your_backend_ethereum_account_private_key # For submitting proofs to the contract
ZK_PROOF_LOG_CONTRACT_ADDRESS=your_deployed_ZKProofLog_contract_address

# ZK-SNARK Service Configuration (for Backend)
ZK_SNARK_SERVICE_URL=http://zksnark_service:8000 # Service name in docker-compose

# Frontend Configuration (Next.js specific, consumed during build or runtime)
# These are typically prefixed with NEXT_PUBLIC_ if needed by the browser.
# If your frontend directly calls the backend, it will use the API_URL.
# For example, if your frontend needs to know the backend URL:
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

**Note on Frontend Environment Variables:**
Next.js requires environment variables intended for browser-side access to be prefixed with `NEXT_PUBLIC_`.
The `NEXT_PUBLIC_API_BASE_URL` is an example. If your frontend makes API calls, it will use this.
The `docker-compose.yaml` file might pass some of these variables to the respective services. Ensure it aligns with your `.env` file.

### Deployment with Docker

The entire KinChain application (frontend, backend, ZK-SNARK service, and PostgreSQL database) can be deployed using Docker Compose.

1. **Clone the repository (if you haven't already):**

   ```bash
   git clone <your-repository-url>
   cd kinChain
   ```

2. **Create and populate the `.env` file:**

   In the root directory of the `kinChain` project (alongside `docker-compose.yaml`), create a `.env` file and fill it with the necessary environment variables as listed above.

3. **Build and run the containers:**

   From the root directory of the `kinChain` project:

   ```bash
   docker-compose up --build
   ```

   To run in detached mode:

   ```bash
   docker-compose up --build -d
   ```

4. **Accessing the application:**

   - **Frontend:** `http://localhost:3000` (or the port specified for the frontend service in `docker-compose.yaml`)
   - **Backend API:** `http://localhost:3001` (or the port specified for the backend service)

### Local Development (Frontend Only, without Docker)

If you want to run the frontend locally for development and connect to a backend (either Dockerized or running elsewhere):

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   # or
   # yarn install
   # or
   # pnpm install
   ```

3. **Set up environment variables for the frontend:**

   Create a `.env.local` file in the `frontend` directory:

   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 # Or your backend URL
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   # or
   # yarn dev
   # or
   # pnpm dev
   ```

   The frontend will be available at `http://localhost:3000`.

## Key Features Implemented

- Family registration.
- Individual (Relation) registration with links to families.
- Designation of a "Family Head" for a relation.
- Hierarchical lineage display.
- Generation of ZK-proofs for lineage claims using a Rust-based ZK-SNARK service.
- Submission of proofs to an Ethereum smart contract (`ZKProofLog.sol`).

## Project Structure (Frontend)

- `components/`: Reusable React components.
  - `FamilyRegisterPage/`: Components for family registration.
  - `generateProofPage/`: Components for initiating proof generation.
  - `relationRegisterPage/`: Components for relation registration.
  - `returnData/`: Components for displaying lineage and search results.
  - `validateProofPage/`: Components for proof validation.
- `interfaces/`: TypeScript interfaces for data structures.
- `pages/`: Next.js pages, mapping to application routes.
  - `api/`: API routes handled by Next.js (if any, most API logic is in the NestJS backend).
- `styles/`: Global CSS and Tailwind CSS configuration.
- `public/`: Static assets.

## Available Scripts (in `frontend/package.json`)

- `dev`: Runs the Next.js development server.
- `build`: Builds the Next.js application for production.
- `start`: Starts the Next.js production server.
- `lint`: Lints the codebase.
- `type-check`: Runs TypeScript type checking.

This README provides a guide to understanding, deploying, and developing the frontend of the KinChain application. For backend details, refer to `backend/README.md`.
