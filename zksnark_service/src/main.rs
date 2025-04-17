use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use bellman::groth16::{
    create_random_proof, generate_random_parameters, prepare_verifying_key, verify_proof, Proof,
};
use bellman::{Circuit, ConstraintSystem, SynthesisError};
use bls12_381::{Bls12, G1Affine, G2Affine, Scalar as Fr};
use ff::{Field, PrimeField};
use hex;
use lazy_static::lazy_static;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{Cursor, Read, Write};
use std::sync::Mutex;

#[derive(Deserialize)]
#[allow(dead_code)]
struct ProofRequest {
    id: String,
    #[serde(rename = "firstName")]
    first_name: String,
    #[serde(rename = "lastName")]
    last_name: String,
    age: u64,
    address: String,
    #[serde(rename = "dateOfBirth")]
    date_of_birth: String,
    condition: String,
    email: String,
    phone: String,
    #[serde(rename = "input")]
    input: u64, // Added the input field that's used in generate_proof
}

#[derive(Clone)]
struct MyCircuit {
    pub a: Option<Fr>,
}

impl Circuit<Fr> for MyCircuit {
    fn synthesize<CS: ConstraintSystem<Fr>>(self, cs: &mut CS) -> Result<(), SynthesisError> {
        let a = cs.alloc(|| "a", || self.a.ok_or(SynthesisError::AssignmentMissing))?;
        let out = cs.alloc_input(
            || "public input",
            || {
                let val = self.a.ok_or(SynthesisError::AssignmentMissing)?;
                Ok(val.square())
            },
        )?;

        cs.enforce(|| "a * a = out", |lc: bellman::LinearCombination<_>| lc + a, |lc: bellman::LinearCombination<_>| lc + a, |lc: bellman::LinearCombination<_>| lc + out);

        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct ProofResponse {
    proof: Vec<u8>,
    public_input: Vec<u8>,
}

lazy_static! {
    static ref PARAMS: Mutex<
        Option<(
            bellman::groth16::Parameters<Bls12>,
            bellman::groth16::PreparedVerifyingKey<Bls12>,
        )>,
    > = Mutex::new(None);
}

// generate_proof endpoint (update for correct public input encoding)
#[post("/generate-proof")]
async fn generate_proof(input: web::Json<ProofRequest>) -> impl Responder {
    let a_val: Fr = Fr::from(input.input);
    let output_val: Fr = a_val.square();

    let mut params_lock: std::sync::MutexGuard<'_, Option<(bellman::groth16::Parameters<Bls12>, bellman::groth16::PreparedVerifyingKey<Bls12>)>> = PARAMS.lock().unwrap();
    if params_lock.is_none() {
        let params: bellman::groth16::Parameters<Bls12> =
            generate_random_parameters::<Bls12, _, _>(MyCircuit { a: Some(a_val) }, &mut OsRng)
                .expect("parameter generation failed");
        let pvk: bellman::groth16::PreparedVerifyingKey<Bls12> = prepare_verifying_key(&params.vk);
        *params_lock = Some((params, pvk));
    }
    let (params, _) = params_lock.as_ref().unwrap();
    let proof: Proof<Bls12> = create_random_proof(MyCircuit { a: Some(a_val) }, params, &mut OsRng)
        .expect("proof generation failed");
    let mut proof_bytes: Vec<u8> = vec![];
    proof.write(&mut proof_bytes).unwrap();

    // Explicitly use Little Endian bytes for public input encoding
    let mut public_input_bytes = [0u8; 32];
    public_input_bytes.copy_from_slice(&output_val.to_repr()); // to_repr returns LE bytes

    HttpResponse::Ok().json(ProofResponse {
        proof: proof_bytes,
        public_input: public_input_bytes.to_vec(), // 32-byte vec for single field element
    })
}

// Endpoint function
// verify-proof endpoint (for clarity)
#[post("/verify-proof")]
async fn verify_proof_endpoint(
    proof_data: web::Json<ProofResponse>,
) -> Result<HttpResponse, actix_web::Error> {
    let proof: Proof<Bls12> = match Proof::<Bls12>::read(&mut Cursor::new(&proof_data.proof)) {
        Ok(p) => p,
        Err(e) => {
            println!("Invalid proof format: {:?}", e);
            return Ok(HttpResponse::BadRequest().json("Invalid proof format"));
        }
    };

    println!("✅ Received Proof: {:?}", proof);

    let mut public_input: Vec<Fr> = Vec::new();
    let mut cursor: Cursor<&Vec<u8>> = Cursor::new(&proof_data.public_input);

    loop {
        let mut buf: [u8; 32] = [0u8; 32];
        match cursor.read_exact(&mut buf) {
            Ok(_) => {
                println!("🔍 Received Fr bytes (LE): {}", hex::encode(buf));
                match Fr::from_bytes(&buf).into() {
                    Some(fr) => public_input.push(fr),
                    None => {
                        println!("⚠️ Invalid Fr bytes encountered: {}", hex::encode(buf));
                        return Err(actix_web::error::ErrorBadRequest("Invalid Fr bytes"));
                    }
                }
            }
            Err(_) => break,
        }
    }

    println!("✅ Parsed Public Input Elements: {:?}", public_input);

    if public_input.len() != 1 {
        println!(
            "⚠️ Received public input length: {}, expected: 1",
            public_input.len()
        );
        return Ok(HttpResponse::BadRequest().json("Invalid public input length"));
    }

    let final_input: Fr = public_input[0];
    println!("✅ Final Public Input Element: {:?}", final_input);

    let params_lock: std::sync::MutexGuard<'_, Option<(bellman::groth16::Parameters<Bls12>, bellman::groth16::PreparedVerifyingKey<Bls12>)>> = PARAMS.lock().unwrap();
    if params_lock.is_none() {
        println!("⚠️ Verification parameters not initialized");
        return Ok(HttpResponse::InternalServerError().json("Parameters not initialized"));
    }

    let (_, pvk) = params_lock.as_ref().unwrap();
    let is_valid: bool = verify_proof(&pvk, &proof, &public_input).is_ok();

    if is_valid {
        Ok(HttpResponse::Ok().json(json!({"valid": true, "message": "Proof is valid"})))
    } else {
        Ok(HttpResponse::Ok().json(json!({"valid": false, "message": "Proof is invalid"})))
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("🚀 Starting Zero-Knowledge Proof service on http://localhost:8080");
    HttpServer::new(|| {
        App::new()
            .service(generate_proof)
            .service(verify_proof_endpoint)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
