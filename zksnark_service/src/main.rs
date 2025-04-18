use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use bellman::groth16::{
    create_random_proof, generate_random_parameters, prepare_verifying_key, verify_proof, Proof,
};
use bellman::{Circuit, ConstraintSystem, SynthesisError};
use bls12_381::{Bls12, Scalar as Fr};
use ff::{Field, PrimeField};
use lazy_static::lazy_static;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{Cursor, Read, Write};
use std::sync::Mutex;

// Hash to field helper (SHA256)
#[allow(dead_code)]
fn hash_to_fr(fields: &[&str]) -> Fr {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    for field in fields {
        hasher.update(field.as_bytes());
    }
    let hash: sha2::digest::generic_array::GenericArray<u8, sha2::digest::typenum::UInt<sha2::digest::typenum::UInt<sha2::digest::typenum::UInt<sha2::digest::typenum::UInt<sha2::digest::typenum::UInt<sha2::digest::typenum::UInt<sha2::digest::typenum::UTerm, sha2::digest::consts::B1>, sha2::digest::consts::B0>, sha2::digest::consts::B0>, sha2::digest::consts::B0>, sha2::digest::consts::B0>, sha2::digest::consts::B0>> = hasher.finalize();
    // Use first 32 bytes as canonical little endian number mod Fr::MODULUS
    // You could use from_bytes_wide for even longer hash, but this is fine
    Fr::from_bytes_wide(&<[u8; 64]>::try_from([hash.as_slice(), hash.as_slice()].concat().as_slice()).unwrap())
}

// For actual ZKP, hash should be done inside circuit using Poseidon or MiMC.
// For prototype, do outside as public input and verify user knows preimage.

#[derive(Deserialize)]
pub struct ProofRequest {
    pub hospital_id: String,
    pub treatment: String,
    pub patient_id: String,
}

// You can add more fields if needed
#[derive(Clone)]
pub struct MyCircuit {
    // private inputs
    pub hospital_id: Option<Fr>,
    pub treatment: Option<Fr>,
    pub patient_id: Option<Fr>,
    // public input (the commitment)
    pub commitment: Option<Fr>,
}

impl Circuit<Fr> for MyCircuit {
    fn synthesize<CS: ConstraintSystem<Fr>>(self, cs: &mut CS) -> Result<(), SynthesisError> {
        // Allocate private inputs
        let h_id: bellman::Variable = cs.alloc(|| "hospital_id", || self.hospital_id.ok_or(SynthesisError::AssignmentMissing))?;
        let trt: bellman::Variable = cs.alloc(|| "treatment", || self.treatment.ok_or(SynthesisError::AssignmentMissing))?;
        let p_id: bellman::Variable = cs.alloc(|| "patient_id", || self.patient_id.ok_or(SynthesisError::AssignmentMissing))?;
        // Allocate public commitment
        let commitment: bellman::Variable = cs.alloc_input(
            || "public commitment",
            || self.commitment.ok_or(SynthesisError::AssignmentMissing),
        )?;

        // Note: No in-circuit hash. Only constrain: "hospital_id + treatment + patient_id == commitment"
        // (Just for prototype. Real ZKP use in-circuit hash like Poseidon)
        // sum = hospital_id + treatment + patient_id
        let sum: bellman::Variable = cs.alloc(|| "sum",
            || {
                let a: Fr = self.hospital_id.ok_or(SynthesisError::AssignmentMissing)?;
                let b: Fr = self.treatment.ok_or(SynthesisError::AssignmentMissing)?;
                let c: Fr = self.patient_id.ok_or(SynthesisError::AssignmentMissing)?;
                Ok(a + b + c)
            }
        )?;

        // Enforce sum = hospital_id + treatment + patient_id
        cs.enforce(
            || "enforce sum",
            |lc: bellman::LinearCombination<_>| lc + h_id + trt + p_id,
            |lc: bellman::LinearCombination<_>| lc + CS::one(),
            |lc: bellman::LinearCombination<_>| lc + sum,
        );

        // Enforce commitment = hash(preimages) -- for prototype: commitment == sum
        cs.enforce(
            || "enforce commitment",
            |lc: bellman::LinearCombination<_>| lc + sum,
            |lc: bellman::LinearCombination<_>| lc + CS::one(),
            |lc: bellman::LinearCombination<_>| lc + commitment,
        );

        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
pub struct ProofResponse {
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

#[post("/generate-proof")]
async fn generate_proof(input: web::Json<ProofRequest>) -> impl Responder {
    // 1. Hash the (hospital_id, treatment, patient_id) to create a field element for commitment
    // 2. Use the Fr::from_str for hospital, treatment, patient. (Or use your own encoding/conversion)
    // For demo: just take first 31 bytes of UTF-8, pad to 32
    let to_fr = |x: &String| {
        let mut bytes = [0u8; 32];
        let x_bytes = x.as_bytes();
        for (i, b) in x_bytes.iter().take(32).enumerate() {
            bytes[i] = *b;
        }
        Fr::from_bytes(&bytes).unwrap()
    };

    let hospital_id_fr = to_fr(&input.hospital_id);
    let treatment_fr = to_fr(&input.treatment);
    let patient_id_fr = to_fr(&input.patient_id);

    // For prototype: commitment = hospital_id + treatment + patient_id
    // For real: use hash_to_fr(&[hospital_id, treatment, patient_id])
    let commitment = hospital_id_fr + treatment_fr + patient_id_fr;

    // Set up params only once for this circuit shape
    let mut params_lock = PARAMS.lock().unwrap();
    if params_lock.is_none() {
        let params = generate_random_parameters::<Bls12, _, _>(
            MyCircuit {
                hospital_id: Some(hospital_id_fr),
                treatment: Some(treatment_fr),
                patient_id: Some(patient_id_fr),
                commitment: Some(commitment),
            },
            &mut OsRng,
        ).expect("parameter generation failed");
        let pvk = prepare_verifying_key(&params.vk);
        *params_lock = Some((params, pvk));
    }
    let (params, _) = params_lock.as_ref().unwrap();

    let proof: Proof<Bls12> = create_random_proof(
        MyCircuit {
            hospital_id: Some(hospital_id_fr),
            treatment: Some(treatment_fr),
            patient_id: Some(patient_id_fr),
            commitment: Some(commitment),
        },
        params,
        &mut OsRng
    ).expect("proof generation failed");

    let mut proof_bytes: Vec<u8> = vec![];
    proof.write(&mut proof_bytes).unwrap();

    let mut public_input_bytes: [u8; 32] = [0u8; 32];
    public_input_bytes.copy_from_slice(&commitment.to_repr());

    HttpResponse::Ok().json(ProofResponse {
        proof: proof_bytes,
        public_input: public_input_bytes.to_vec(),
    })
}

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
    let mut public_input: Vec<Fr> = Vec::new();
    let mut cursor: Cursor<&Vec<u8>> = Cursor::new(&proof_data.public_input);
    loop {
        let mut buf: [u8; 32] = [0u8; 32];
        match cursor.read_exact(&mut buf) {
            Ok(_) => {
                match Fr::from_bytes(&buf).into() {
                    Some(fr) => public_input.push(fr),
                    None => {
                        println!("Invalid Fr bytes encountered");
                        return Err(actix_web::error::ErrorBadRequest("Invalid Fr bytes"));
                    }
                }
            }
            Err(_) => break,
        }
    }
    if public_input.len() != 1 {
        return Ok(HttpResponse::BadRequest().json("Invalid public input length"));
    }
    let params_lock: std::sync::MutexGuard<'_, Option<(bellman::groth16::Parameters<Bls12>, bellman::groth16::PreparedVerifyingKey<Bls12>)>> = PARAMS.lock().unwrap();
    if params_lock.is_none() {
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