use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use bellperson::gadgets::num::AllocatedNum;
use bellperson::groth16::{
    create_random_proof, generate_random_parameters, prepare_verifying_key, verify_proof, Proof,
};
use bellperson::{Circuit, ConstraintSystem, SynthesisError};
use blstrs::Bls12;
use blstrs::Scalar as Fr; // Use Fr from blstrs
use ff::PrimeField;
use lazy_static::lazy_static;
use neptune::circuit::poseidon_hash;
use neptune::poseidon::{Poseidon, PoseidonConstants};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Cursor;
use std::sync::Mutex;
use typenum::U3;

fn string_to_fr(s: &str) -> blstrs::Scalar {
    use blstrs::Scalar as Fr;
    use num_bigint::BigUint;
    use sha2::{Digest, Sha256};

    let hash = Sha256::digest(s.as_bytes());
    let hash_int = BigUint::from_bytes_be(&hash);
    // Use a hardcoded modulus if MODULUS is a string
    let modulus = BigUint::parse_bytes(
        b"73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001",
        16,
    )
    .unwrap();
    let reduced = hash_int % &modulus;
    let mut reduced_bytes = reduced.to_bytes_be();
    if reduced_bytes.len() < 32 {
        let mut tmp = vec![0u8; 32 - reduced_bytes.len()];
        tmp.extend_from_slice(&reduced_bytes);
        reduced_bytes = tmp;
    }
    let arr: [u8; 32] = reduced_bytes.as_slice().try_into().unwrap();
    Fr::from_bytes_be(&arr).unwrap()
}

#[derive(Deserialize)]
pub struct ProofRequest {
    pub hospital_id: String,
    pub treatment: String,
    pub patient_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct ProofResponse {
    proof: Vec<u8>,
    public_input: Vec<u8>,
}

#[derive(Clone)]
pub struct MyCircuit {
    // Private inputs
    pub hospital_id: Option<Fr>,
    pub treatment: Option<Fr>,
    pub patient_id: Option<Fr>,
    // Public input (the commitment)
    pub commitment: Option<Fr>,
}

// Circuit implementation
impl Circuit<Fr> for MyCircuit {
    fn synthesize<CS: ConstraintSystem<Fr>>(self, cs: &mut CS) -> Result<(), SynthesisError> {
        let hospital_id = AllocatedNum::alloc(&mut *cs, || {
            self.hospital_id.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let treatment = AllocatedNum::alloc(&mut *cs, || {
            self.treatment.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let patient_id = AllocatedNum::alloc(&mut *cs, || {
            self.patient_id.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let commitment_var = cs.alloc_input(
            || "commitment",
            || self.commitment.ok_or(SynthesisError::AssignmentMissing),
        )?;
        let params: PoseidonConstants<Fr, typenum::UInt<typenum::UInt<typenum::UTerm, typenum::B1>, typenum::B1>> = PoseidonConstants::<Fr, U3>::new();
        let preimages: Vec<AllocatedNum<Fr>> = vec![hospital_id.clone(), treatment.clone(), patient_id.clone()];
        let hash: AllocatedNum<Fr> = poseidon_hash(&mut *cs, preimages, &params)?;
        cs.enforce(
            || "commitment is poseidon hash",
            |lc: bellperson::LinearCombination<_>| lc + hash.get_variable(),
            |lc: bellperson::LinearCombination<_>| lc + CS::one(),
            |lc: bellperson::LinearCombination<_>| lc + commitment_var,
        );
        Ok(())
    }
}

lazy_static! {
    static ref PARAMS: Mutex<
        Option<(
            bellperson::groth16::Parameters<Bls12>,
            bellperson::groth16::PreparedVerifyingKey<Bls12>,
        )>,
    > = Mutex::new(None);
}

#[post("/generate-proof")]
async fn generate_proof(input: web::Json<ProofRequest>) -> impl Responder {
    // Canonical mapping for all fields
    let hospital_id_fr = string_to_fr(&input.hospital_id);
    let treatment_fr = string_to_fr(&input.treatment);
    let patient_id_fr = string_to_fr(&input.patient_id);

    // Calculate commitment (host Poseidon)
    let constants = PoseidonConstants::<Fr, U3>::new();
    let mut poseidon = Poseidon::new(&constants);
    poseidon
        .input(hospital_id_fr)
        .expect("Failed to input hospital_id");
    poseidon
        .input(treatment_fr)
        .expect("Failed to input treatment");
    poseidon
        .input(patient_id_fr)
        .expect("Failed to input patient_id");
    let commitment = poseidon.hash();

    println!("=== GENERATE PROOF ===");
    println!(
        "hospital_id: {:?} => {:?}",
        input.hospital_id,
        hospital_id_fr.to_repr()
    );
    println!(
        "treatment:   {:?} => {:?}",
        input.treatment,
        treatment_fr.to_repr()
    );
    println!(
        "patient_id:  {:?} => {:?}",
        input.patient_id,
        patient_id_fr.to_repr()
    );
    println!("commitment:{:?}", commitment.to_repr());
    println!("commitment (hex): 0x{}", hex::encode(commitment.to_repr()));

    // Path to the CRS (params) file, using the Docker mount
    let params_path = "zkp-params/groth16_params.bin";
    let mut params_lock = PARAMS.lock().unwrap();
    if params_lock.is_none() {
        println!("Looking for cached SNARK parameters...");
        match std::fs::File::open(params_path) {
            Ok(mut fp) => {
                println!("Loading SNARK parameters from file...");
                let params = bellperson::groth16::Parameters::<Bls12>::read(&mut fp, false)
                    .expect("Failed to read Groth16 parameters");
                let pvk = prepare_verifying_key(&params.vk);
                *params_lock = Some((params, pvk));
            }
            Err(_e) => {
                // === TRUSTED SETUP: GENERATE THE PARAMS IF MISSING ===
                println!("groth16_params.bin not found, running trusted setup to create it (ONLY FOR DEV!)");
                // Ensure the directory exists before saving file
                std::fs::create_dir_all("zkp-params")
                    .expect("Could not create parameter output directory");
                let params = generate_random_parameters::<Bls12, _, _>(
                    MyCircuit {
                        hospital_id: None,
                        treatment: None,
                        patient_id: None,
                        commitment: None,
                    },
                    &mut OsRng,
                )
                .expect("parameter generation failed");
                let pvk = prepare_verifying_key(&params.vk);
                // Save parameters to file
                let mut fp =
                    std::fs::File::create(params_path).expect("could not create params file");
                params.write(&mut fp).expect("Failed to write params");
                println!("Params saved to {}", params_path);
                *params_lock = Some((params, pvk));
                // === END TRUSTED SETUP GENERATION ===
            }
        }
    }
    // From here, you have guaranteed loaded params in params_lock
    let (params, _) = params_lock.as_ref().unwrap();
    println!("PARAMS pointer: {:p}", params);
    println!(
        "MyCircuit for proof: hospital_id: {:?}, treatment: {:?}, patient_id: {:?}, commitment: {:?}", 
        hospital_id_fr, treatment_fr, patient_id_fr, commitment
    );
    let proof: Proof<Bls12> = create_random_proof(
        MyCircuit {
            hospital_id: Some(hospital_id_fr),
            treatment: Some(treatment_fr),
            patient_id: Some(patient_id_fr),
            commitment: Some(commitment),
        },
        params,
        &mut OsRng,
    )
    .expect("proof generation failed");
    let mut proof_bytes: Vec<u8> = vec![];
    proof.write(&mut proof_bytes).unwrap();
    let mut public_input_bytes: [u8; 32] = [0u8; 32];
    public_input_bytes.copy_from_slice(&commitment.to_repr());
    println!("PROOF BYTES: {:?}", proof_bytes);
    println!("PUBLIC INPUT BYTES: {:?}", public_input_bytes);
    HttpResponse::Ok().json(ProofResponse {
        proof: proof_bytes,
        public_input: public_input_bytes.to_vec(),
    })
}

#[post("/verify-proof")]
async fn verify_proof_endpoint(
    proof_data: web::Json<ProofResponse>,
) -> Result<HttpResponse, actix_web::Error> {
    println!("=== VERIFY PROOF ===");
    println!("Proof bytes: {:?}", proof_data.proof);
    println!("Public input bytes: {:?}", proof_data.public_input);
    println!(
        "public_input (hex): 0x{}",
        hex::encode(&proof_data.public_input)
    );
    // Parse proof
    let proof: Proof<Bls12> = match Proof::<Bls12>::read(&mut Cursor::new(&proof_data.proof)) {
        Ok(p) => p,
        Err(e) => {
            println!("Invalid proof format: {:?}", e);
            return Ok(HttpResponse::BadRequest().json("Invalid proof format"));
        }
    };
    // Public input parsing
    if proof_data.public_input.len() != 32 {
        println!("Public input not 32 bytes: {:?}", proof_data.public_input);
        return Ok(HttpResponse::BadRequest().json("Invalid public input length, expected 32"));
    }
    let mut buf = [0u8; 32];
    buf.copy_from_slice(&proof_data.public_input[0..32]);
    let comm_fr = Fr::from_repr(buf);
    if comm_fr.is_some().into() {
        let fr = comm_fr.unwrap();
        println!("Decoded public input as Fr: {:?}", fr.to_repr());
        let public_input = vec![fr];
        // Load params and verify
        let params_lock = PARAMS.lock().unwrap();
        if params_lock.is_none() {
            return Ok(HttpResponse::InternalServerError().json("Parameters not initialized"));
        }
        let (_, pvk) = params_lock.as_ref().unwrap();
        println!("PVK pointer: {:p}", pvk);
        let verification_result = verify_proof(&pvk, &proof, &public_input);
        match verification_result {
            Ok(true) => {
                println!("Proof verified? true");
                Ok(HttpResponse::Ok().json(json!({"valid": true, "message": "Proof is valid"})))
            }
            Ok(false) => {
                println!("Proof verified? false (invalid proof)");
                Ok(HttpResponse::Ok().json(json!({"valid": false, "message": "Proof is invalid"})))
            }
            Err(e) => {
                println!("Error during proof verification: {:?}", e);
                Ok(HttpResponse::InternalServerError()
                    .json(json!({"valid": false, "message": format!("Verifier error: {:?}", e)})))
            }
        }
    } else {
        println!("Invalid Fr bytes: {:?}", buf);
        return Ok(HttpResponse::BadRequest().json("Invalid Fr bytes"));
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
