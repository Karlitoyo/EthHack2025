FROM rust:latest AS builder

WORKDIR /usr/src/app
# 1. Copy manifests and source separately to optimize cache use
COPY Cargo.toml .
COPY Cargo.lock .

# 2. Only copy source now (this busts the cache for next steps if source changes)
COPY . .

# 3. Build release binary
RUN cargo build --release

FROM rust:latest
WORKDIR /app
COPY --from=builder /usr/src/app/target/release/zksnark_service .

EXPOSE 8080
CMD ["./zksnark_service"]
