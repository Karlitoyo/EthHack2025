## Dissertation - Karl Timmins

## Zero Knowledge Proofs - Irish Medical Sector

## Application Overview

This project demonstrates the use of Zero-Knowledge Proofs (ZKPs) within the Irish medical sector context. It allows hospitals to record patient treatments and generate ZKPs to prove specific treatment details without revealing all patient information. The system consists of the following components:

*   **Backend (NestJS):** Handles API requests, interacts with the database, manages hospital and patient data, coordinates with the ZKP service, and interacts with the Ethereum blockchain.
*   **Frontend (Next.js):** Provides a user interface for hospitals to manage patient data, generate treatment proofs, and potentially validate proofs (depending on implementation).
*   **ZKP Service (Rust/Actix):** A dedicated service responsible for generating and verifying Groth16 ZK-SNARK proofs based on treatment data and Merkle tree inclusion. It uses the Bellperson library.
*   **Database (PostgreSQL):** Stores hospital and patient information.
*   **Ethereum Interaction:** The backend includes functionality to submit proof details (like Merkle roots and commitments) to an Ethereum smart contract (`ZKProofLog`).

## Setup

### Environment Variables

Create a `.env` file in the project's root directory with the following variables:

```env
# Database Configuration (used by backend and db service)
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=hospital_db
DB_HOST=db # Service name in docker-compose
DB_PORT=5432

# Backend Ethereum Configuration
ETH_PROVIDER_URL=http://your_ethereum_node_rpc_url # e.g., Infura, Alchemy, or local node
PRIVATE_KEY=your_ethereum_wallet_private_key # For submitting proofs to the contract
ZK_PROOF_LOG_CONTRACT=your_deployed_zkprooflog_contract_address
ZKP_SERVICE_URL=http://rust-zkp-service:port_number

# Frontend (Optional - if needed by Next.js build/runtime)
# NEXT_PUBLIC_...=...
```

**Note:** Ensure the `PRIVATE_KEY` corresponds to an account with sufficient funds on the target Ethereum network to pay for transaction gas fees.

### ZKP Parameters

The ZKP service requires pre-generated parameters (`groth16_params.bin`) and a corresponding hash file (`params.circuit_hash`) located in the `zkp-params/` directory.

1.  **First Run:** When starting the `zksnark_service` for the first time via Docker Compose, it will automatically perform a trusted setup if the parameter files are missing or if the circuit hash doesn't match the current code. This process can take a significant amount of time.
2.  **Subsequent Runs:** If the files exist and the hash matches, the service will load the existing parameters.
3.  **Volume Mount:** The `docker-compose.yaml` mounts the local `./zkp-params` directory into the container at `/app/zkp-params`, ensuring persistence of these files.

## Deployment with Docker

The application is containerized using Docker and orchestrated with Docker Compose.

1.  **Prerequisites:**
    *   Docker installed: [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/)
    *   Docker Compose installed: [https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/)
2.  **Create `.env` file:** As described in the "Environment Variables" section above, create the `.env` file in the project root.
3.  **Build and Run:** Open a terminal in the project root directory (`/home/karlito/projects/dissertation`) and run:

    ```bash
    docker-compose up --build
    ```

    *   `--build`: Forces Docker to rebuild the images if any changes were made to Dockerfiles or application code.
    *   The first time you run this, it might take longer due to downloading base images, installing dependencies, and potentially generating ZKP parameters.

4.  **Accessing Services:**
    *   **Frontend:** `http://localhost:4000`
    *   **Backend API:** `http://localhost:4001`
    *   **ZKP Service:** `http://localhost:8080` (Primarily used by the backend)
    *   **Database:** Accessible internally via port `5432` (or `5433` from the host machine).

5.  **Stopping the Application:** Press `Ctrl+C` in the terminal where `docker-compose up` is running. To remove the containers and network, run:

    ```bash
    docker-compose down
    ```

    To remove the database volume (and lose all data), add the `-v` flag:

    ```bash
    docker-compose down -v
    ```